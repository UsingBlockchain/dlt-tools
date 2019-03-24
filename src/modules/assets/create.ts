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
} from 'nem2-sdk';

import {
    convert,
    mosaicId,
    nacl_catapult,
    uint64 as uint64_t
} from "nem2-library";
import * as readlineSync from 'readline-sync';

// internal dependencies
import {
    OptionsResolver,
    UInt64OptionsResolver
} from '../../core/Options';
import {Action, BaseOptions} from '../../core/Action';

export class CommandOptions extends BaseOptions {
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
}

@command({
    description: 'Create named assets for your Business.',
})
export default class extends Action {

    constructor() {
        super();
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read parameters
        const {
            name,
            divisibility,
            supplyMutable,
            transferable,
            levyMutable,
            initialSupply,
        } = this.readArguments(options);

        // add a block monitor
        this.monitor.monitorBlocks();

        // also add address monitors
        this.monitor.monitorAddress(this.getAddress("tester1").plain());

        // shortcuts
        const address = this.getAddress("tester1");
        const account = this.getAccount("tester1");

        // read account information
        const accountHttp = new AccountHttp(this.connector.peerUrl);
        const accountInfo = await accountHttp.getAccountInfo(this.getAddress("tester1")).toPromise();

        // build transactions

        // STEP 1: register namespace(s)
        const namespaceTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            name
        );

        // STEP 2.1: create MosaicDefinition transaction
        const mosaicDefinitionTx = this.getCreateMosaicTransaction(
            account.publicAccount,
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
            mosaicDefinitionTx.toAggregate(account.publicAccount),
            mosaicSupplyTx.toAggregate(account.publicAccount)
        ];

        // STEP 3: create MosaicAlias transaction to link lower level namespace to mosaic
        const aliasTxes = this.getCreateAliasTransactions(
            account.publicAccount,
            name,
            mosaicDefinitionTx.mosaicId
        );

        // STEP 4: merge transactions and broadcast
        const allTxes = [].concat(namespaceTxes, mosaicDefinitionTxes, aliasTxes);
        return await this.broadcastAggregateMosaicConfiguration(account, allTxes);
    }

    public async broadcastAggregateMosaicConfiguration(
        account: Account,
        configTransactions: Transaction[]
    ): Promise<Object> 
    {
        const aggregateTx = AggregateTransaction.createComplete(
            Deadline.create(),
            configTransactions,
            NetworkType.MIJIN_TEST,
            []
        );

        const signedTransaction = account.sign(aggregateTx);

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
                UInt64.fromUint(100000), // 100'000 blocks
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

    protected readArguments(options: CommandOptions): any {
        let name;
        let divisibility;
        let supplyMutable;
        let transferable;
        let levyMutable;
        let initialSupply;

        try {
            name = OptionsResolver(options, 'name', () => { return ''; }, 'Enter an asset name: ');
        } catch (err) { throw new ExpectedError('Please enter a valid mosaic name'); }

        try {
            divisibility = OptionsResolver(options, 'divisibility', () => { return ''; }, 'Enter a mosaic divisibility: ');
        } catch (err) { throw new ExpectedError('Please enter a valid asset divisibility (0-6).'); }

        try {
            supplyMutable = readlineSync.keyInYN('Should the supply be mutable ?');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the supply should be mutable.'); }

        try {
            transferable = readlineSync.keyInYN('Should the asset be transferable?');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the supply should be mutable.'); }

        try {
            levyMutable = readlineSync.keyInYN('Should the levy fee be mutable?');
        } catch (err) { throw new ExpectedError('Please enter Yes or No for whether the supply should be mutable.'); }

        try {
            initialSupply = UInt64OptionsResolver(options, 'initialSupply', () => { return ''; }, 'Enter an initial supply: ');
        } catch (err) { throw new ExpectedError('Please enter a valid initial supply.'); }

        return {
            name,
            divisibility,
            supplyMutable,
            transferable,
            levyMutable,
            initialSupply
        };
    }
}
