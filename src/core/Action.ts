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
import {Command, ExpectedError, option, Options} from 'clime';
import {Spinner} from 'cli-spinner';
import {
    Account,
    Address,
    Listener,
    NetworkType,
    UInt64,
} from 'nem2-sdk';

import * as Path from 'path';
import * as fs from 'fs';

// internal deps
import {Bootstrap} from './Bootstrap';
import {Connector} from './Connector';
import {Monitor} from './Monitor';

/**
 * Class `BaseOptions` provides a base for
 * command line options parsing.
 * 
 * @since 0.0.1
 */
export class BaseOptions extends Options {}

/**
 * Class `Action` describes a base command line action.
 * 
 * Other labels for actions would be `commands`.
 * 
 * @since 0.0.1
 */
export abstract class Action extends Command {

    /**
     * Configuration object
     * @var {Object}
     */
    protected readonly config;

    /**
     * Connector object
     * @var {Connector}
     */
    public readonly connector;

    /**
     * Monitor object
     * @var {Monitor}
     */
    public readonly monitor;

    /**
     * Accounts storage
     * @var {Object}
     */
    private accounts = {};

    /**
     * Construct an Action object
     * 
     * This will run the bootstrapper (configuration) and
     * instantiate the connector and monitors.
     */
    constructor() {
        super();

        // run configuration
        const app = new Bootstrap();
        this.config = app.getConfig();

        if (! this.config.version) {
            const text = chalk.red("Error in configuration file conf/app.json.");
            console.log(text);
        }

        // initialize dep-inject
        this.connector = new Connector(this.config);
        this.monitor = new Monitor(this.config, this.connector);
    }

    /**
     * Get account by name (and network)
     * 
     * @param name          Account configuration name
     * @param networkType   Network type
     * @return {Account}
     */
    public getAccount(
        name: string,
        networkType?: NetworkType
    ): Account {
        if (! this.config.accounts.hasOwnProperty(name)) {
            throw new Error('Account with name "' + name + '" does not exist.');
        }

        // storage by network type
        const network = networkType || NetworkType.MIJIN_TEST;

        if (!this.accounts.hasOwnProperty(network)) {
            this.accounts[network] = {};
        }

        // known_accounts
        if (this.accounts[network].hasOwnProperty(name)) {
            return this.accounts[network][name];
        }

        const privateKey = this.config.accounts[name].toUpperCase();
        return this.accounts[network][name] = Account.createFromPrivateKey(
            privateKey,
            networkType || NetworkType.MIJIN_TEST
        );
    }

    /**
     * Get address by name (and network)
     * 
     * @param name          Account configuration name
     * @param networkType   Network type
     * @return {Account}
     */
    public getAddress(
        name: string,
        networkType?: NetworkType
    ): Address {
        const account = this.getAccount(name, networkType);
        return account.address;
    }
}
