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
    MosaicHttp,
    MosaicNonce,
    Deadline,
    NamespaceId,
    TransactionHttp,
    PublicAccount,
    Transaction,
    AggregateTransaction,
    Mosaic,
    Address,
    TransferTransaction,
    EmptyMessage,
    PlainMessage,
    NetworkCurrencyMosaic,
    HashLockTransaction,
    SignedTransaction,
    Listener,
    CosignatureTransaction,
    CosignatureSignedTransaction,
} from 'nem2-sdk';
import * as readlineSync from 'readline-sync';
import {from as observableFrom} from 'rxjs';
import {filter, map, mergeMap} from 'rxjs/operators';

// internal dependencies
import {
    OptionsResolver,
    UInt64OptionsResolver
} from '../../core/Options';
import {AuthenticatedAction, IdentityOptions} from '../../core/AuthenticatedAction';

export class CommandOptions extends IdentityOptions {
    @option({
        flag: 'r',
        description: 'Pull request recipient identity',
    })
    recipient: string;

    @option({
        flag: 'n',
        description: 'Asset name',
    })
    asset: string;

    @option({
        flag: 'a',
        description: 'Amount',
    })
    amount: string;
}

@command({
    description: 'Issue a fund pull request to the scope owner identity.',
})
export default class extends AuthenticatedAction {

    constructor() {
        super();
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        const namespaceHttp = new NamespaceHttp(this.connector.peerUrl);
        const mosaicHttp = new MosaicHttp(this.connector.peerUrl);

        // read identity first
        const userIdentity = this.getIdentity(options);

        // read parameters
        const {
            recipient,
            assetName,
            amount,
        } = this.readArguments(options);

        // add a block monitor
        this.monitor.monitorBlocks();

        // shortcuts
        const userAccount = userIdentity.account;
        const userAddress = userIdentity.account.address;

        // build transactions

        // STEP 1: send a pull request
        // This transaction will be signed with the `userIdentity`
        const requestFundsTx = TransferTransaction.create(
            Deadline.create(),
            recipient.account.address,
            [],
            PlainMessage.create('pullRequest:' + JSON.stringify({asset: assetName, amount: amount.compact()})),
            NetworkType.MIJIN_TEST
        );

        // STEP 2: send funds from `recipient` identity to `userIdentity`
        // This transaction will be signed by `recipient` identity
        const fundsTx = TransferTransaction.create(
            Deadline.create(),
            userAddress,
            [new Mosaic(new NamespaceId(assetName), amount)],
            EmptyMessage,
            NetworkType.MIJIN_TEST
        );

        // Aggregate Bonded Preparation:
        // - Fund request is signed by user identity
        // - Transfer transaction is signed by recipient identity
        const requestTxes: Transaction[] = [];
        requestTxes.push(requestFundsTx.toAggregate(userIdentity.account.publicAccount));
        requestTxes.push(fundsTx.toAggregate(recipient.account.publicAccount));

        // STEP 3: merge transactions
        const allTxes = [].concat(requestTxes);

        // STEP 4: prepare the aggregate bonded transaction
        const aggregateTx = AggregateTransaction.createBonded(
            Deadline.create(),
            allTxes,
            NetworkType.MIJIN_TEST,
            []
        );

        // STEP 5: sign aggregate bonded transaction with user identity
        const signedTransaction = userIdentity.account.sign(aggregateTx);

        // STEP 6: create a HashLockTransaction
        const mosaicId = await namespaceHttp.getLinkedMosaicId(NetworkCurrencyMosaic.NAMESPACE_ID).toPromise();
        const lockFundsTransaction = HashLockTransaction.create(
            Deadline.create(),
            new Mosaic(mosaicId, UInt64.fromUint(10000000)), // lock 10 cat.currency
            UInt64.fromUint(100), // duration 100 blocks
            signedTransaction,
            NetworkType.MIJIN_TEST,
        );

        // STEP 7: sign the hash-lock transaction
        const signedLockFundsTransaction = userIdentity.account.sign(lockFundsTransaction);

        // add address monitor to get status updates
        this.monitor.monitorAddress(recipient.account.address.plain());

        // sign transaction and broadcast
        return await this.broadcastPullRequest(
            userIdentity.account.publicAccount,
            recipient.account,
            signedLockFundsTransaction,
            signedTransaction
        );
    }

    public async broadcastPullRequest(
        issuerAccount: PublicAccount,
        cosignerAccount: Account,
        signedHashLockTx: SignedTransaction,
        signedAggregateTx: SignedTransaction
    ): Promise<any>
    {
        const transactionHttp = new TransactionHttp(this.connector.peerUrl);

        //XXX refactor to use monitors
        const listener = new Listener(this.connector.peerUrl);
        return listener.open().then(() => {

            // STEP 1: announce hash lock and wait until included in block
            // STEP 2: announce aggregate bonded
            // STEP 3: co-sign aggregate bonded with recipient identity
            return new Promise(async (resolve, reject) => {
                // announce hash-lock and subscribe to errors
                transactionHttp
                    .announce(signedHashLockTx)
                    .subscribe(x => {
                        console.log('Announced hash lock transaction');
                        console.log('Hash:   ', signedHashLockTx.hash);
                        console.log('Signer: ', signedHashLockTx.signer, '\n');
                        console.log('');
                        console.log('Waiting to be included in a block..');
                    }, err => console.error(err));

                // when the lock funds is confirmed, send the aggregate-bonded
                return observableFrom(listener.confirmed(issuerAccount.address)).pipe(
                    filter((transaction) =>
                            transaction.transactionInfo !== undefined
                        && transaction.transactionInfo.hash === signedHashLockTx.hash),
                    mergeMap(ignored => {
                        let text = chalk.green('Hash lock Confirmed!');
                        console.log(text, '\n');
                        console.log('');
                        console.log('Waiting for pull request recipient co-signature..');

                        // announce aggregate bonded transaction
                        return transactionHttp.announceAggregateBonded(signedAggregateTx);
                    })
                )
                .subscribe(async (announcedAggregateBonded) => {
                    console.log('Announced aggregate bonded transaction');
                    console.log('Hash:   ', signedAggregateTx.hash);
                    console.log('Signer: ', signedAggregateTx.signer, '\n');

                    // now broadcast co-signature
                    const result = await this.cosignPullRequest(cosignerAccount, signedAggregateTx);

                    return resolve(announcedAggregateBonded);
                }, err => console.error(err));
            });
        });

    }

    public async cosignPullRequest(
        cosignerAccount: Account,
        signedAggregateTx: SignedTransaction
    ): Promise<any>
    {
        const transactionHttp = new TransactionHttp(this.connector.peerUrl);
        const accountHttp = new AccountHttp(this.connector.peerUrl);

        // read unsigned transactions
        const unsignedTxes = await accountHttp.aggregateBondedTransactions(cosignerAccount.publicAccount).toPromise();

        // create a cosignatory helper function to co-sign any aggregte
        const cosignHelper = (
            transaction: AggregateTransaction,
            account: Account
        ): CosignatureSignedTransaction => {
            const cosignatureTransaction = CosignatureTransaction.create(transaction);
            return account.signCosignatureTransaction(cosignatureTransaction);
        };

        // filter by unsigned and cosign transaction
        return new Promise(async (resolve, reject) => {
            return observableFrom(unsignedTxes).pipe(
                filter((_) => !_.signedByAccount(cosignerAccount.publicAccount)),
                map(transaction => cosignHelper(transaction, cosignerAccount)),
                mergeMap(signedSignature => {
                    console.log('Signed cosignature transaction');
                    console.log('Parent Hash: ', signedSignature.parentHash);
                    console.log('Signer:      ', signedSignature.signer, '\n');

                    // announce cosignature
                    return transactionHttp.announceAggregateBondedCosignature(signedSignature);
                })
            ).subscribe((announcedTransaction) => {
                console.log(chalk.green('Announced cosignature transaction'), '\n');
                return resolve(announcedTransaction);
            }, err => console.error(err));
        });
    }

    public readArguments(options: CommandOptions): any {
        let recipient;
        let assetName;
        let amount;

        try {
            recipient = this.getIdentity({
                scope: options.scope,
                identity: options.recipient
            });
        } catch (err) { throw new ExpectedError('Please enter a valid pull request recipient identity (--recipient)'); }

        try {
            assetName = OptionsResolver(options, 'asset', () => { return ''; }, 'Enter an asset name: ');
        } catch (err) { throw new ExpectedError('Please enter a valid asset name'); }

        try {
            amount = UInt64OptionsResolver(options, 'amount', () => { return ''; }, 'Enter an amount: ');
        } catch (err) { throw new ExpectedError('Please enter a valid amount.'); }

        return {
            recipient,
            assetName,
            amount,
        };
    }
}
