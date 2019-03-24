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

/**
 * Class `Connector` describes a HTTP/Websocket
 * connection.
 *
 * @since 0.0.1
 */
export class Connector {

    /**
     * URL of connected peer
     * @var {Listener}
     */
    public peerUrl = null;

    constructor(
        /**
         * Configuration object
         * @var {Object}
         */
        protected readonly config,
    ) {
        const peers = this.config.peers;
        this.peerUrl = peers.shift();
    }
}

