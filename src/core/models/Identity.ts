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
 * as well as to a peer host.
 * 
 * @since 0.2.0
 */
export class Identity {

    constructor(public readonly account: Account,
                public readonly networkType: NetworkType,
                public readonly url: string,
                public readonly name: string) {

    }

    toString(): string {
        return this.name + '-> \n\tNetwork:\t' + NetworkType[this.networkType]
        + '\n\tName:\t\t' + (this.name || 'default')
        + '\n\tUrl:\t\t' + this.url
        + '\n\tAddress:\t' + this.account.address.plain()
        + '\n\tPublicKey:\t' + this.account.publicKey
        + '\n\tPrivateKey:\t' + this.account.privateKey
        + '\n';
    }
}
