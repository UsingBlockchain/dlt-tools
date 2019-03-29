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
     * Read command line arguments
     * @param   options     The command line arguments
     * @return {Object}
     */
    public abstract readArguments(options: BaseOptions): any;
}
