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
} from 'nem2-sdk';
import * as readlineSync from 'readline-sync';

// internal dependencies
import {
    OptionsResolver,
    UInt64OptionsResolver
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

export class CommandOptions extends BaseOptions {
    @option({
        flag: 'n',
        description: 'Identity name',
    })
    name: string;

    @option({
        flag: 'c',
        description: 'Network Type: MAIN_NET, TEST_NET, MIJIN, MIJIN_TEST',
        validator: new NetworkValidator(),
    })
    network: string;

    @option({
        flag: 'l',
        description: 'Create the identity locally',
        toggle: true
    })
    local: string;

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
        throw new ExpectedError('Please enter a valid network type');
    }
}

@command({
    description: 'Create named Identities for your Business.',
})
export default class extends Action {
    private readonly identityService: IdentityService;

    constructor() {
        super();

        const identityRepository = new IdentityRepository('.nem2-business.json');
        this.identityService = new IdentityService(identityRepository);
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read parameters
        const {
            name,
            networkType,
            local,
        } = this.readArguments(options);

        // create identity locally
        const account = Account.generateNewAccount(networkType);
        const identity = this.identityService.createNewIdentity(account, 'http://localhost:3000', name);

        // should the identity be kept private ?
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
        this.monitor.monitorAddress(account.address.plain());

        // build transactions

        const identityNamespace = "business.identities." + name.replace(/[^A-Za-z0-9\-_]+/g, '');
        const nameNamespace = "business.names." + name.replace(/[^A-Za-z0-9\-_]+/g, '');

        // STEP 1: register identities namespace(s)
        const namespaceTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            identityNamespace
        );

        const mosaicTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            nameNamespace
        );

        // STEP 2.1: create MosaicDefinition transaction
        //
        // Each identity owns its custom asset with divisibility=0, supply=1
        // and being non-transferable (named with subnamespace of business.names)
        const mosaicDefinitionTx = this.getCreateMosaicTransaction(
            account.publicAccount,
            0,
            false,
            false
        );

        // STEP 2.2: create MosaicSupplyChange transaction (supply=1)
        const mosaicSupplyTx = this.getMosaicSupplyChangeTransaction(
            mosaicDefinitionTx.mosaicId,
            UInt64.fromUint(1) // identities have a supply of 1
        );

        // STEP 2.3: prepare mosaic definition for aggregate
        const mosaicDefinitionTxes = [
            mosaicDefinitionTx.toAggregate(account.publicAccount),
            mosaicSupplyTx.toAggregate(account.publicAccount)
        ];

        // STEP 3: create MosaicAlias transaction to link lower level namespace to mosaic
        const mosaicAliasTxes = this.getCreateMosaicAliasTransactions(
            account.publicAccount,
            nameNamespace,
            mosaicDefinitionTx.mosaicId
        );

        // STEP 4: link address with `identityNamespace`
        const addressAliasTxes = this.getCreateAddressAliasTransactions(
            account.publicAccount,
            identityNamespace,
            account.address
        );

        //XXX send `cat.currency` to accounts

        // STEP 5: merge transactions and broadcast
        const allTxes = [].concat(namespaceTxes, mosaicDefinitionTxes, mosaicAliasTxes, addressAliasTxes);
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

    public readArguments(options: CommandOptions): any {
        let name = OptionsResolver(options, 
            'name',
            () => { return ''; },
            'Enter an identity name: ');

        if (!name.length) {
            name = 'default';
        }

        const networkType = options.getNetwork(OptionsResolver(options,
            'network',
            () => undefined,
            'Enter a network type (MIJIN_TEST, MIJIN, MAIN_NET, TEST_NET): '));

        const local = readlineSync.keyInYN('Do you wish to keep this identity private ?');

        return {
            name,
            networkType,
            local,
        };
    }
}
