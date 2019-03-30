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
import {Account, NetworkType} from 'nem2-sdk';

/**
 * Class `Identity` describes an account and is linked to a network
 * as well as to a peer host and is grouped in a `scope`.
 * 
 * @since 0.2.0
 */
export class Identity {
    /**
     * Automatically field slug for the identity
     * @var {string}
     */
    private slug: string;

    constructor(/**
                 * Linked account
                 * @var {Account}
                 */
                public readonly account: Account,
                /**
                 * Network type
                 * @var {NetworkType}
                 */
                public readonly networkType: NetworkType,
                /**
                 * Peer URL
                 * @var {string}
                 */
                public readonly url: string,
                /**
                 * Scope of the identity
                 * @var {string}
                 */
                public readonly scope: string,
                /**
                 * Name of the identity
                 * @var {string}
                 */
                public readonly name: string,) {

        // automatically set the slug (ID) of the identity
        this.slug = scope + '.' + name;
    }

    getSlug(): string {
        return this.slug;
    }
}
