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
    AccountHttp,
    NamespaceHttp,
    Deadline,
    NamespaceId,
    TransactionHttp,
    PublicAccount,
    Transaction,
    AggregateTransaction,
    RegisterNamespaceTransaction,
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
        description: 'Namespace name',
    })
    name: string;
}

@command({
    description: 'Register on-chain namespaces for your Business.',
})
export default class extends AuthenticatedAction {

    constructor() {
        super();
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read identity first
        const identity = this.getIdentity(options);

        // read parameters
        const {
            name,
        } = this.readArguments(options);

        // add a block monitor
        this.monitor.monitorBlocks();

        // also add address monitors
        this.monitor.monitorAddress(identity.account.address.plain());

        // shortcuts
        const account = identity.account;
        const address = identity.account.address;

        // read account information
        const accountHttp = new AccountHttp(this.connector.peerUrl);
        const accountInfo = await accountHttp.getAccountInfo(address).toPromise();

        // build transactions

        // STEP 1: register namespace(s)
        const namespaceTxes = await this.getCreateNamespaceTransactions(
            account.publicAccount,
            name
        );

        // STEP 2: merge transactions and broadcast
        const allTxes = [].concat(namespaceTxes);
        return await this.broadcastMultiLevelRegisterNamespace(account, allTxes);
    }

    public async broadcastMultiLevelRegisterNamespace(
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
            text += 'broadcastMultiLevelRegisterNamespace() - Error';
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

            console.log("Creating " + registerTxes.length + " RegisterNamespaceTransaction");
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

    public readArguments(options: CommandOptions): any {
        let name;

        try {
            name = OptionsResolver(options, 'name', () => { return ''; }, 'Enter a fully qualified namespace name (Ex. : evias.mosaics.mosaic1): ');
        } catch (err) { throw new ExpectedError('Please enter a valid namespace name'); }

        return {
            name,
        };
    }
}
