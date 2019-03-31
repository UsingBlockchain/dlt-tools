/**
 *
 * Copyright 2019 Grégory Saive for eVias Services (https://evias.be)
 *
 * NOTICE OF LICENSE
 *
 * Licensed under the 3-clause BSD License.
 *
 * This source file is subject to the 3-clause BSD License that is
 * bundled with this package in the LICENSE file.
 *
 * @package    evias-services/nem2-business-tools
 * @version    1.0.0
 * @author     eVias Services <info@evias.be>
 * @license    BSD License (3-clause)
 * @copyright  (c) 2015-2019, eVias Services
 */
// third-party dependencies
import chalk from 'chalk';
import {command, ExpectedError, metadata, option} from 'clime';
import {
    UInt64,
    Account,
    NetworkType,
    MosaicId,
    AccountHttp,
    NamespaceHttp,
    MosaicNonce,
    Deadline,
    NamespaceId,
    TransactionHttp,
    PublicAccount,
    Transaction,
    AggregateTransaction,
    MosaicDefinitionTransaction,
    MosaicProperties,
    MosaicSupplyChangeTransaction,
    MosaicSupplyType,
    MosaicAliasTransaction,
    AliasActionType,
    RegisterNamespaceTransaction,
    Mosaic,
    Address,
    TransferTransaction,
    EmptyMessage,
} from 'nem2-sdk';
import * as readlineSync from 'readline-sync';

// internal dependencies
import {
    OptionsResolver,
    UInt64OptionsResolver
} from '../../core/Options';
import {AuthenticatedAction, IdentityOptions} from '../../core/AuthenticatedAction';

export class CommandOptions extends IdentityOptions {
    @option({
        flag: 'n',
        description: 'Asset name',
    })
    name: string;

    @option({
        flag: 'd',
        description: 'Divisibility [0, 6]',
    })
    divisibility: number;

    @option({
        flag: 's',
        description: 'Mutable supply Mosaic [yes|No]',
        toggle: true
    })
    supplyMutable: boolean;

    @option({
        flag: 't',
        description: 'Transferable Mosaic [Yes|no]',
        toggle: true
    })
    transferable: boolean;

    @option({
        flag: 'l',
        description: 'Mutable Levy Fee [yes|No]',
        toggle: true
    })
    levyMutable: boolean;

    @option({
        flag: 'i',
        description: 'Initial supply (number|UInt64)',
    })
    initialSupply: string;

    // @option({
    //     flag: 'f',
    //     description: 'Set Levy Fee [yes|No]',
    //     toggle: true
    // })
    // hasLevy: boolean;

    // @option({
    //     flag: 'm',
    //     description: 'Levy Mosaic Id',
    // })
    // levyMosaicId: string;

    // @option({
    //     flag: 'v',
    //     description: 'Levy Type',
    // })
    // levyType: number;

    // @option({
    //     flag: 'a',
    //     description: 'Levy Amount',
    // })
    // levyAmount: string;
}

@command({
    description: 'Create named assets for your Business.',
})
export default class extends AuthenticatedAction {

    constructor() {
        super();
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read identity first
        const userIdentity = this.getIdentity(options);
        const ownerIdentity = this.identityService.findIdentityByScopeAndName(userIdentity.scope, 'owner');

        // read parameters
        const {
            name,
            divisibility,
            supplyMutable,
            transferable,
            levyMutable,
            initialSupply,
            // hasLevy,
            // levyMosaicId,
            // levyType,
            // levyAmount,
        } = this.readArguments(options);

        // add a block monitor
        this.monitor.monitorBlocks();

        // also add address monitors
        this.monitor.monitorAddress(ownerIdentity.account.address.plain());

        // shortcuts
        const userAccount = userIdentity.account;
        const userAddress = userIdentity.account.address;

        // build transactions

        // STEP 1: register namespace(s)
        const namespaceTxes = await this.getCreateNamespaceTransactions(
            ownerIdentity.account.publicAccount,
            name
        );

        // STEP 2.1: create MosaicDefinition transaction
        const mosaicDefinitionTx = this.getCreateMosaicTransaction(
            ownerIdentity.account.publicAccount,
            divisibility,
            supplyMutable,
            transferable
        );

        // STEP 2.2: create MosaicSupplyChange transaction
        const mosaicSupplyTx = this.getMosaicSupplyChangeTransaction(
            mosaicDefinitionTx.mosaicId,
            initialSupply
        );

        // prepare mosaic definition for aggregate
        const mosaicDefinitionTxes = [
            mosaicDefinitionTx.toAggregate(ownerIdentity.account.publicAccount),
            mosaicSupplyTx.toAggregate(ownerIdentity.account.publicAccount)
        ];

        // STEP 3: create MosaicAlias transaction to link lower level namespace to mosaic
        const aliasTxes = this.getCreateAliasTransactions(
            ownerIdentity.account.publicAccount,
            name,
            mosaicDefinitionTx.mosaicId
        );

        // STEP 4: send created mosaic to specified identity FROM owner identity
        const asset = new Mosaic(new NamespaceId(name), initialSupply);
        const transferTx = this.getTransferTransaction(userAccount.address, asset);
        const transferTxes = [transferTx.toAggregate(ownerIdentity.account.publicAccount)];

        // STEP 5: merge transactions
        const allTxes = [].concat(namespaceTxes, mosaicDefinitionTxes, aliasTxes, transferTxes);

        // STEP 6: retrieve cosigners and issuer account
        const issuer: Account = ownerIdentity.account;
        const cosigners: Account[] = [];

        return await this.broadcastAggregateMosaicConfiguration(issuer, cosigners, allTxes);
    }

    public async broadcastAggregateMosaicConfiguration(
        issuer: Account,
        cosigners: Account[],
        configTransactions: Transaction[]
    ): Promise<Object> 
    {
        const aggregateTx = AggregateTransaction.createComplete(
            Deadline.create(),
            configTransactions,
            NetworkType.MIJIN_TEST,
            []
        );

        // sign either with issuer + cosigners or only with issuer.
        let signedTransaction;
        if (cosigners.length) {
            signedTransaction = issuer.signTransactionWithCosignatories(aggregateTx, cosigners);
        } else {
            signedTransaction = issuer.sign(aggregateTx);
        }
        // announce/broadcast transaction
        const transactionHttp = new TransactionHttp(this.connector.peerUrl);
        return transactionHttp.announce(signedTransaction).subscribe(() => {
            console.log('Transaction announced correctly');
            console.log('Hash:   ', signedTransaction.hash);
            console.log('Signer: ', signedTransaction.signer);
        }, (err) => {
            let text = '';
            text += 'broadcastAggregateMosaicConfiguration() - Error';
            console.log(text, err.response !== undefined ? err.response.text : err);
        });
    }

    public async getCreateNamespaceTransactions(
        publicAccount: PublicAccount,
        namespaceName: string
    ): Promise<Object>
    {
        const isSub = /\.{1,}/.test(namespaceName);
        const namespaceId = new NamespaceId(namespaceName);
        const namespaceHttp = new NamespaceHttp(this.connector.peerUrl);

        // namespace doesn't exist
        const parts = namespaceName.split('.');
        if (parts.length > 3) {
            throw new Error('Invalid namespace name "' + namespaceName + '", maximum 3 levels allowed.');
        }

        return new Promise(async (resolve, reject) => {
            let registerTxes = [];
            for (let i = 0; i < parts.length; i++) {
                const fullName = i === 0 ? parts[0] : parts.slice(0, i+1).join('.');
                const registerTx = this.getCreateNamespaceTransaction(fullName);
                registerTxes.push(registerTx.toAggregate(publicAccount));

                try {
                    const namespaceId = new NamespaceId(fullName);
                    const namespaceInfo = await namespaceHttp.getNamespace(namespaceId).toPromise();

                    // namespace exists
                    registerTxes.pop();
                }
                catch(e) {} // Do nothing, namespace "Error: Not Found"
            }

            console.log("Step 1) Creating " + registerTxes.length + " RegisterNamespaceTransaction");
            return resolve(registerTxes);
        });
    }

    public getCreateNamespaceTransaction(
        namespaceName: string
    ): RegisterNamespaceTransaction
    {
        const isSub = /\.{1,}/.test(namespaceName);
        const parts = namespaceName.split('.');
        const parent = parts.slice(0, parts.length-1).join('.');
        const current = parts.pop();

        let registerTx;
        if (isSub === true) {
            // sub namespace level[i]
            registerTx = RegisterNamespaceTransaction.createSubNamespace(
                Deadline.create(),
                current,
                parent,
                NetworkType.MIJIN_TEST
            );
        }
        else {
            // root namespace
            registerTx = RegisterNamespaceTransaction.createRootNamespace(
                Deadline.create(),
                namespaceName,
                UInt64.fromUint(1000000), // 1'000'000 blocks = ~170 days with 15 second blocks
                NetworkType.MIJIN_TEST
            );
        }

        return registerTx;
    }

    public getCreateMosaicTransaction(
        publicAccount: PublicAccount,
        divisibility: number,
        supplyMutable: boolean,
        transferable: boolean
    ): MosaicDefinitionTransaction
    {
        // create nonce and mosaicId
        const nonce = MosaicNonce.createRandom();
        const mosId = MosaicId.createFromNonce(nonce, publicAccount);
        const props = {
            supplyMutable: supplyMutable,
            transferable: transferable,
            levyMutable: false,
            divisibility: divisibility,
            duration: UInt64.fromUint(1000000), // 1'000'000 blocks
        };

        console.log('Step 2.1) Creating MosaicDefinitionTransaction with mosaicId: ' + JSON.stringify(mosId.id));
        console.log('Step 2.2) Creating MosaicDefinitionTransaction with properties: ' + JSON.stringify(props));

        const createTx = MosaicDefinitionTransaction.create(
            Deadline.create(),
            nonce,
            mosId,
            MosaicProperties.create(props),
            NetworkType.MIJIN_TEST
        );

        return createTx;
    }

    public getMosaicSupplyChangeTransaction(
        mosaicId: MosaicId,
        initialSupply: UInt64
    ): MosaicSupplyChangeTransaction
    {
        console.log('Step 2.1) Creating MosaicSupplyChangeTransaction with mosaicId: ' + JSON.stringify(mosaicId.id));
        const supplyTx = MosaicSupplyChangeTransaction.create(
            Deadline.create(),
            mosaicId,
            MosaicSupplyType.Increase,
            initialSupply,
            NetworkType.MIJIN_TEST
        );

        return supplyTx;
    }

    public getCreateAliasTransactions(
        publicAccount: PublicAccount,
        namespaceName: string,
        mosaicId: MosaicId
    ): Transaction[]
    {
        const namespaceId = new NamespaceId(namespaceName);
        const actionType  = AliasActionType.Link;

        console.log('Step 3) Creating MosaicAliasTransaction with for namespace: ' + namespaceName);
        const aliasTx = MosaicAliasTransaction.create(
            Deadline.create(),
            actionType,
            namespaceId,
            mosaicId,
            NetworkType.MIJIN_TEST
        );

        return [
            aliasTx.toAggregate(publicAccount),
        ];
    }

    public getTransferTransaction(
        recipient: Address | NamespaceId,
        assets: Mosaic
    ): TransferTransaction
    {
        console.log('- Creating TransferTransaction with Mosaic: ' + JSON.stringify(assets));
        const transferTx = TransferTransaction.create(
            Deadline.create(),
            recipient,
            [assets],
            EmptyMessage,
            NetworkType.MIJIN_TEST
        );

        return transferTx;
    }

    public readArguments(options: CommandOptions): any {
        let name;
        let divisibility;
        let supplyMutable;
        let transferable;
        let levyMutable;
        let hasLevy;
        let levyMosaicId;
        let levyType;
        let levyAmount;
        let initialSupply;

        try {
            name = OptionsResolver(options, 'name', () => { return ''; }, 'Enter an asset name: ');
        } catch (err) { throw new ExpectedError('Please enter a valid mosaic name'); }

        try {
            divisibility = OptionsResolver(options, 'divisibility', () => { return ''; }, 'Enter a mosaic divisibility: ');
        } catch (err) { throw new ExpectedError('Please enter a valid asset divisibility (0-6).'); }

        try {
            initialSupply = UInt64OptionsResolver(options, 'initialSupply', () => { return ''; }, 'Enter an initial supply: ');
        } catch (err) { throw new ExpectedError('Please enter a valid initial supply.'); }

        try {
            supplyMutable = readlineSync.keyInYN('Should the supply be mutable ? ');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the supply should be mutable.'); }

        try {
            transferable = readlineSync.keyInYN('Should the asset be transferable? ');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the asset should be transferable.'); }

        try {
            levyMutable = readlineSync.keyInYN('Should the levy fee be mutable? ');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the levy fee should be mutable.'); }

        // try {
        //     hasLevy = readlineSync.keyInYN('Should the asset include a Levy Fee? ');
        // } catch (err) { throw new ExpectedError('Please enter Yes or No for whether there should be a levy fee.'); }

        // if (hasLevy === true) {

        //     try {
        //         levyMosaicId = UInt64OptionsResolver(options, 'levyMosaicId', () => { return ''; }, 'Enter a levy fee Mosaic Id: ');
        //     } catch (err) { throw new ExpectedError('Please enter a valid levy fee mosaicId.'); }

        //     try {
        //         levyType = OptionsResolver(options, 'levyType', () => { return ''; }, 'Enter a Levy Type (0: Absolute | 1: Percentile): ');
        //     } catch (err) { throw new ExpectedError('Please enter a valid asset levyType (0-1).'); }

        //     try {
        //         levyAmount = UInt64OptionsResolver(options, 'levyAmount', () => { return ''; }, 'Enter a levy fee Amount: ');
        //     } catch (err) { throw new ExpectedError('Please enter a valid levy fee amount.'); }
        // }

        return {
            name,
            divisibility,
            supplyMutable,
            transferable,
            levyMutable,
            initialSupply,
            // hasLevy,
            // levyMosaicId,
            // levyType,
            // levyAmount,
        };
    }
}
