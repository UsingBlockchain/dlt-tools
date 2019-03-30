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
import {command, ExpectedError, metadata, option, ValidationContext, Validator} from 'clime';
import {
    UInt64,
    Account,
    Address,
    AddressAliasTransaction,
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
    EmptyMessage,
    TransferTransaction,
} from 'nem2-sdk';
import * as readlineSync from 'readline-sync';

// internal dependencies
import {
    OptionsResolver,
    MosaicOptionsResolver
} from '../../core/Options';
import {Action, BaseOptions} from '../../core/Action';
import {IdentityRepository} from '../../core/repositories/IdentityRepository';
import {IdentityService} from '../../core/services/IdentityService';

export class NetworkValidator implements Validator<string> {
    validate(value: string, context: ValidationContext): void {
        if (!(value === 'MIJIN' || value === 'MIJIN_TEST' || value === 'MAIN_NET' || value === 'TEST_NET')) {
            throw new ExpectedError('Please enter a valid network type');
        }
    }
}

export class MosaicValidator implements Validator<string> {
    validate(value: string, context: ValidationContext): void {
        if (! /[0-9]+ [0-9a-zA-Z\.\-_]+/.test(value)) {
            throw new ExpectedError('Please enter a valid mosaic amount (Ex.: 1000 cat.currency)');
        }
    }
}

export class CommandOptions extends BaseOptions {
    @option({
        flag: 'n',
        description: 'Identity name',
    })
    name: string;

    @option({
        flag: 's',
        description: 'Scope name',
    })
    scope: string;

    @option({
        flag: 'c',
        description: 'Network Type: MAIN_NET, TEST_NET, MIJIN, MIJIN_TEST',
        validator: new NetworkValidator(),
    })
    network: string;

    @option({
        flag: 'l',
        description: 'Create the identity only locally',
        toggle: true
    })
    local: string;

    @option({
        flag: 'a',
        description: 'Add assets to the created identity',
        validator: new MosaicValidator(),
    })
    assets: string;

    getNetwork(network: string): NetworkType {
        if (network === 'MAIN_NET') {
            return NetworkType.MAIN_NET;
        } else if (network === 'TEST_NET') {
            return NetworkType.TEST_NET;
        } else if (network === 'MIJIN') {
            return NetworkType.MIJIN;
        } else if (network === 'MIJIN_TEST') {
            return NetworkType.MIJIN_TEST;
        }

        return NetworkType.MIJIN_TEST;
    }
}

@command({
    description: 'Create named Identities for your Scope.',
})
export default class extends Action {
    private readonly identityService: IdentityService;
    private plannedNamespaces = [];

    constructor() {
        super();

        const identityRepository = new IdentityRepository(this.config.storageFile);
        this.identityService = new IdentityService(identityRepository);
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read parameters
        const {
            name,
            scopeName,
            networkType,
            local,
            assets,
        } = this.readArguments(options);

        const cleanScope = scopeName.replace(/[^A-Za-z0-9\-_]+/g, '');
        const cleanName = name.replace(/[^A-Za-z0-9\-_]+/g, '');

        // get the previously created scope owner identity
        const ownerIdentity = this.identityService.findIdentityByScopeAndName(cleanScope, 'owner');

        // create scoped identity locally
        const identityAccount = Account.generateNewAccount(networkType);
        const identity = this.identityService.createNewIdentity(identityAccount, 'http://localhost:3000', cleanScope, cleanName);

        if (local === true && assets instanceof Mosaic) {
            // local identity should still receive mosaics if any must be sent
            const transferTx = this.getTransferTransaction(identityAccount.address, assets);

            // send funds to identity and quit
            const allTxes = [transferTx.toAggregate(ownerIdentity.account.publicAccount)];
            return await this.broadcastAggregateIdentityConfiguration(ownerIdentity.account, [], allTxes);
        }

        // local identity and no funds sent
        if (local === true) {
            // print identity and quit
            console.log('\n' + identity.toString() + '\n');
            return false;
        }

        //
        // identity will be defined on-chain with aliasing features
        //

        // add a block monitor
        this.monitor.monitorBlocks();

        // also add address monitors
        this.monitor.monitorAddress(identityAccount.address.plain());

        // build transactions

        // STEP 1: send `cat.currency` to created account FROM the business identity
        const transferTx = this.getTransferTransaction(identityAccount.address, assets);
        const transferTxes = [transferTx.toAggregate(ownerIdentity.account.publicAccount)];

        // STEP 2: register identities namespace(s)
        const identityNamespace = cleanScope + ".identities." + cleanName;
        const nameNamespace = cleanScope + ".names." + cleanName;

        const namespaceTxes = await this.getCreateNamespaceTransactions(
            ownerIdentity.account.publicAccount,
            identityNamespace
        );

        const mosaicTxes = await this.getCreateNamespaceTransactions(
            ownerIdentity.account.publicAccount,
            nameNamespace
        );

        // STEP 3.1: create MosaicDefinition transaction
        //
        // Each identity owns its custom asset with divisibility=0, supply=1
        // and being non-transferable (named with subnamespace of business.names)
        const mosaicDefinitionTx = this.getCreateMosaicTransaction(
            ownerIdentity.account.publicAccount,
            0,
            false,
            false
        );

        // STEP 3.2: create MosaicSupplyChange transaction (supply=1)
        const mosaicSupplyTx = this.getMosaicSupplyChangeTransaction(
            mosaicDefinitionTx.mosaicId,
            UInt64.fromUint(1) // identities have a supply of 1
        );

        // STEP 3.3: prepare mosaic definition for aggregate
        const mosaicDefinitionTxes = [
            mosaicDefinitionTx.toAggregate(ownerIdentity.account.publicAccount),
            mosaicSupplyTx.toAggregate(ownerIdentity.account.publicAccount)
        ];

        // STEP 4: create MosaicAlias transaction to link lower level namespace to mosaic
        const mosaicAliasTxes = this.getCreateMosaicAliasTransactions(
            ownerIdentity.account.publicAccount,
            nameNamespace,
            mosaicDefinitionTx.mosaicId
        );

        // STEP 5: link address with `identityNamespace`
        const addressAliasTxes = this.getCreateAddressAliasTransactions(
            ownerIdentity.account.publicAccount,
            identityNamespace,
            identityAccount.address
        );

        // STEP 6: merge transactions and broadcast
        const allTxes = [].concat(
            transferTxes,
            namespaceTxes,
            mosaicTxes,
            mosaicDefinitionTxes,
            mosaicAliasTxes,
            addressAliasTxes
        );

        // STEP 7: send `business.names.name` to created account FROM the business identity
        const asset = new Mosaic(new NamespaceId(nameNamespace), UInt64.fromUint(1));
        const identityTransferTx = this.getTransferTransaction(identityAccount.address, asset);
        allTxes.push(identityTransferTx.toAggregate(ownerIdentity.account.publicAccount));

        // STEP 8: retrieve cosigners and issuer account
        const issuer: Account = ownerIdentity.account;
        const cosigners: Account[] = [];

        // STEP 9: broadcast the aggregate transaction
        return await this.broadcastAggregateIdentityConfiguration(issuer, cosigners, allTxes);
    }

    public async broadcastAggregateIdentityConfiguration(
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
            text += 'broadcastAggregateIdentityConfiguration() - Error';
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

                if (this.plannedNamespaces.find((val) => { return val === fullName })) {
                    // namespace creation already programmed
                    registerTxes.pop();
                } else {
                    // register namespace creation to avoid multi creation of same namespace
                    this.plannedNamespaces.push(fullName);
                }
            }

            console.log("- Creating " + registerTxes.length + " RegisterNamespaceTransaction");
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

        console.log('- Creating MosaicDefinitionTransaction with mosaicId: ' + JSON.stringify(mosId.id));
        console.log('- Creating MosaicDefinitionTransaction with properties: ' + JSON.stringify(props));

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
        console.log('- Creating MosaicSupplyChangeTransaction with mosaicId: ' + JSON.stringify(mosaicId.id));
        const supplyTx = MosaicSupplyChangeTransaction.create(
            Deadline.create(),
            mosaicId,
            MosaicSupplyType.Increase,
            initialSupply,
            NetworkType.MIJIN_TEST
        );

        return supplyTx;
    }

    public getCreateMosaicAliasTransactions(
        publicAccount: PublicAccount,
        namespaceName: string,
        mosaicId: MosaicId
    ): Transaction[]
    {
        const namespaceId = new NamespaceId(namespaceName);
        const actionType  = AliasActionType.Link;

        console.log('- Creating MosaicAliasTransaction with namespace: ' + namespaceName);
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

    public getCreateAddressAliasTransactions(
        publicAccount: PublicAccount,
        namespaceName: string,
        address: Address
    ): Transaction[]
    {
        const namespaceId = new NamespaceId(namespaceName);
        const actionType  = AliasActionType.Link;

        console.log('- Creating AddressAliasTransaction with namespace: ' + namespaceName);
        const aliasTx = AddressAliasTransaction.create(
            Deadline.create(),
            actionType,
            namespaceId,
            address,
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
        let name = OptionsResolver(options, 
            'name',
            () => { return ''; },
            'Enter an identity name: ');

        if (!name.length) {
            name = 'default';
        }

        let scopeName = OptionsResolver(options, 
            'scope',
            () => { return ''; },
            'Enter the scope name: ');

        const networkType = options.getNetwork(OptionsResolver(options,
            'network',
            () => undefined,
            'Enter a network type (MIJIN_TEST, MIJIN, MAIN_NET, TEST_NET): '));

        const local = readlineSync.keyInYN('Do you wish to keep this identity private ?');

        const assets = MosaicOptionsResolver(options,
            'assets',
            () => { return ''; },
            'Enter a mosaic amount to be sent (Ex.: 10000000 cat.currency)');

        return {
            name,
            scopeName,
            networkType,
            local,
            assets,
        };
    }
}
