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

    public find(scope: string, name: string): Identity {
        const identities = this.getIdentities();
        const slug = scope + '.' + name;
        if (identities[slug]) {
            return new Identity(
                Account.createFromPrivateKey(identities[slug].privateKey, identities[slug].networkType),
                identities[slug].networkType,
                identities[slug].url,
                identities[slug].scope,
                name);
        }

        throw new Error(`Identity with scope '${scope}' and name '${name}' not found`);
    }

    public all(scope: string): Identity[] {
        const identities = this.getIdentities();
        const list: Identity[] = [];
        for (const name in identities) {

            // scope-limited queries
            if (scope !== '*' && identities[name].scope !== scope) {
                continue;
            }

            list.push(new Identity(
                Account.createFromPrivateKey(identities[name].privateKey, identities[name].networkType),
                identities[name].networkType,
                identities[name].url,
                identities[name].scope,
                name));
        }
        return list;
    }

    public save(account: Account, url: string, scope: string, name: string): Identity {
        const slug = scope + '.' + name;
        const identities = this.getIdentities();
        identities[slug] = {
            scope: scope,
            name: name,
            privateKey: account.privateKey,
            networkType: account.address.networkType,
            url
        };
        this.saveIdentities(identities);
        return new Identity(account, account.address.networkType, url, scope, name);
    }

    public remove(slug: string): any {
        const identities = this.getIdentities();
        if (identities.hasOwnProperty(slug)) {
            delete identities[slug];
        }

        return this.saveIdentities(identities);
    }

    private getIdentities(): any {
        let accounts = {};
        const configPath = require('os').homedir() + '/' + this.fileUrl;
        try {
            // read file content
            accounts = JSON.parse(fs.readFileSync(configPath, 'utf-8') as string);
        } catch (err) {
            // file does not exist
            fs.writeFileSync(configPath, '{}', 'utf-8');
        }
        return accounts;
    }

    private saveIdentities(identities: JSON) {
        const configPath = require('os').homedir() + '/' + this.fileUrl;
        fs.writeFileSync(configPath, JSON.stringify(identities), 'utf-8');
    }
}
