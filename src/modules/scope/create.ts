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
    NetworkCurrencyMosaic,
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
import {Identity} from '../../core/models/Identity';

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
        description: 'Scope name',
    })
    name: string;

    @option({
        flag: 'c',
        description: 'Network Type: MAIN_NET, TEST_NET, MIJIN, MIJIN_TEST',
        validator: new NetworkValidator(),
    })
    network: string;

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
    description: 'Create your Scope with on-chain information.',
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
            networkType,
        } = this.readArguments(options);

        const cleanName = name.replace(/[^A-Za-z0-9\-_]+/g, '');

        // get the nemesis account
        const nemesis = this.identityService.findIdentityByScopeAndName('default', 'network.nemesis');

        let scope: Identity;
        try {
            // get the previously created scope identity
            scope = this.identityService.findIdentityByScopeAndName(cleanName, 'owner');
        }
        catch (e) {
            // JiT creation of the scope identity
            const account = Account.generateNewAccount(networkType);
            scope = this.identityService.createNewIdentity(account, 'http://localhost:3000', cleanName, 'owner');
        }

        //
        // identity will be defined on-chain with aliasing features
        //
        const account = scope.account;
        const address = scope.account.address;

        // add a block monitor
        this.monitor.monitorBlocks();

        // also add address monitors
        this.monitor.monitorAddress(address.plain());

        // build transactions

        // STEP 1: send `50'000'000 cat.currency` to business owner identity FROM nemesis account
        const assets = NetworkCurrencyMosaic.createRelative(50000000);
        const transferTx = this.getTransferTransaction(address, assets);
        const transferTxes = [transferTx.toAggregate(nemesis.account.publicAccount)];

        // STEP 2: register namespaces: business.identities and business.names
        const identitiesNamespace = cleanName + ".identities";
        const namesNamespace = cleanName + ".names";

        const namespaceTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            identitiesNamespace
        );

        const namesTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            namesNamespace
        );

        // STEP 3: merge transactions and broadcast
        const allTxes = [].concat(
            transferTxes,
            namespaceTxes,
            namesTxes,
        );

        // STEP 4: retrieve cosigners and issuer account
        const issuer: Account = nemesis.account;
        const cosigners: Account[] = [];
        cosigners.push(account); // `account` needed to cosign RegisterNamespace

        // STEP 5: broadcast the aggregate transaction
        return await this.broadcastAggregateBusinessConfiguration(issuer, cosigners, allTxes);
    }

    public async broadcastAggregateBusinessConfiguration(
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
            text += 'broadcastAggregateBusinessConfiguration() - Error';
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

        const networkType = options.getNetwork(OptionsResolver(options,
            'network',
            () => undefined,
            'Enter a network type (MIJIN_TEST, MIJIN, MAIN_NET, TEST_NET): '));

        return {
            name,
            networkType,
        };
    }
}
