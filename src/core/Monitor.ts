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
import {
    Address,
    Listener,
} from 'nem2-sdk';

// internal deps
import { Connector } from './connector';

export class Monitor {

    /**
     * Configuration object
     * @var {Object}
     */
    protected config;

    /**
     * Connector object
     * @var {Connector}
     */
    protected connector;

    /**
     * Block websocket listener
     * @var {Listener}
     */
    protected listenerBlocks = null;

    /**
     * Address websocket listener
     * @var {Listener}
     */
    protected listenerAddress = null;

    constructor(config: any, conn: Connector) {
        this.config = config;
        this.connector = conn;

        // initialize listeners if needed
        if (! this.config.disableMonitors) {
            this.listenerBlocks = new Listener(this.connector.peerUrl);
            this.listenerAddress = new Listener(this.connector.peerUrl);
        }
    }

    public monitorBlocks(): any {
        if (this.config.disableMonitors === true) {
            return ;
        }

        this.listenerBlocks.open().then(() => {
            this.listenerBlocks.newBlock()
                .subscribe(block => {
                    if (! this.config.disableLogs) {
                        console.log("[MONITOR] New block created:" + block.height.compact());
                    }
                },
                error => {
                    console.error(error);
                    this.listenerBlocks.terminate();
                });
        });
    }

    public monitorAddress(address: string): any {
        if (this.config.disableMonitors === true) {
            return ;
        }

        this.listenerAddress.open().then(() => {

            // Monitor transaction errors
            this.listenerAddress.status(Address.createFromRawAddress(address))
                .subscribe(error => {
                    let err = chalk.red("[ERROR] Error: ");
                    console.log(err, error);
                },
                error => console.error(error));

            // Monitor confirmed transactions
            this.listenerAddress.confirmed(Address.createFromRawAddress(address))
                .subscribe(tx => {
                    if (! this.config.disableLogs) {
                        let msg = chalk.green("[MONITOR] Confirmed TX: ");
                        console.log(msg, JSON.stringify(tx));
                    }
                },
                error => console.error(error));

            // Monitor unconfirmed transactions
            this.listenerAddress.unconfirmedAdded(Address.createFromRawAddress(address))
                .subscribe(tx => {
                    if (! this.config.disableLogs) {
                        let msg = chalk.yellow("[MONITOR] Unconfirmed TX: ");
                        console.log(msg, JSON.stringify(tx));
                    }
                },
                error => console.error(error));

            // Monitor aggregate bonded transactions
            this.listenerAddress.aggregateBondedAdded(Address.createFromRawAddress(address))
                .subscribe(tx => {
                    if (! this.config.disableLogs) {
                        let msg = chalk.yellow("[MONITOR] Aggregate Bonded TX: ");
                        console.log(msg, JSON.stringify(tx));
                    } 
                },
                error => console.error(error));

            // Monitor cosignature transactions
            this.listenerAddress.cosignatureAdded(Address.createFromRawAddress(address))
                .subscribe(tx => {
                    if (! this.config.disableLogs) {
                        let msg = chalk.yellow("[MONITOR] Cosignature TX: ");
                        console.log(msg, JSON.stringify(tx));
                    }
                },
                error => console.error(error));
        });
    }

    public closeMonitors(): any
    {
        if (! this.config.disableMonitors) {
            this.listenerBlocks.close();
            this.listenerAddress.close();
        }
    }
}
