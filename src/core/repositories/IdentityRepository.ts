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
import * as fs from 'fs';
import {Account} from 'nem2-sdk';
import {Identity} from '../models/Identity';

/**
 * Class `IdentityRepository` provides features for CRUD management
 * of identities within the project.
 * 
 * @since 0.2.0
 */
export class IdentityRepository {

    constructor(private readonly fileUrl: string) {

    }

    public find(name: string): Identity {
        const identities = this.getIdentities();
        if (identities[name]) {
            return new Identity(
                Account.createFromPrivateKey(identities[name].privateKey, identities[name].networkType),
                identities[name].networkType,
                identities[name].url,
                name);
        }
        throw new Error(`${name} not found`);
    }

    public all(): Identity[] {
        const identities = this.getIdentities();
        const list: Identity[] = [];
        for (const name in identities) {
            list.push(new Identity(
                Account.createFromPrivateKey(identities[name].privateKey, identities[name].networkType),
                identities[name].networkType,
                identities[name].url,
                name));
        }
        return list;
    }

    public save(account: Account, url: string, name: string): Identity {
        const identities = this.getIdentities();
        identities[name] = {privateKey: account.privateKey, networkType: account.address.networkType, url};
        this.saveIdentities(identities);
        return new Identity(account, account.address.networkType, url, name);
    }

    private getIdentities(): any {
        let accounts = {};
        try {
            accounts = JSON.parse(fs.readFileSync(require('os').homedir() + '/' + this.fileUrl, 'utf-8') as string);
        } catch (err) {
            fs.writeFileSync(require('os').homedir() + '/' + this.fileUrl, '{}', 'utf-8');
        }
        return accounts;
    }

    private saveIdentities(identities: JSON) {
        fs.writeFileSync(require('os').homedir() + '/' + this.fileUrl, JSON.stringify(identities), 'utf-8');
    }
}
