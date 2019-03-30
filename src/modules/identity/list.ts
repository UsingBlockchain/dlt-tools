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
// third party deps
import chalk from 'chalk';
import {Command, command, metadata, option, Options} from 'clime';
import {NetworkType} from 'nem2-sdk';

// internal deps
import {
    OptionsResolver
} from '../../core/Options';
import {Action, BaseOptions} from '../../core/Action';
import {IdentityRepository} from '../../core/repositories/IdentityRepository';
import {IdentityService} from '../../core/services/IdentityService';
import {Identity} from '../../core/models/Identity';

export class CommandOptions extends Options {
    @option({
        flag: 'n',
        description: 'Identity name',
    })
    name: string;

    @option({
        flag: 's',
        description: 'Scope name',
    })
    scope: string;
}

@command({
    description: 'Display a list of identities',
})

export default class extends Action {
    private readonly identityService: IdentityService;

    constructor() {
        super();
        const identityRepository = new IdentityRepository(this.config.storageFile);
        this.identityService = new IdentityService(identityRepository);
    }

    @metadata
    execute(options: CommandOptions) {

        // read parameters
        const {
            name,
            scopeName,
        } = this.readArguments(options);

        let identities: Identity[] = [];
        if (! scopeName.length || scopeName === '*') {
            // wildcard scopes
            identities = this.identityService.findAll('*');
        } else if (name.length) {
            // filter by identity name
            identities = [this.identityService.findIdentityByScopeAndName(scopeName, name)];
        } else {
            // all identities from scope
            identities = this.identityService.findAll(scopeName);
        }

        let message = '\n';
        identities.map((identity) => {

            message += chalk.green(identity.getSlug()) + '-> '
            + '\n\t' + chalk.yellow('Scope:      ') + chalk.bold(identity.scope)
            + '\n\t' + chalk.yellow('Name:       ') + chalk.bold(identity.name)
            + '\n\t' + chalk.yellow('Network:    ') + chalk.bold('' + NetworkType[identity.networkType])
            + '\n\t' + chalk.yellow('Peer URL:   ') + chalk.bold(identity.url)
            + '\n\t' + chalk.yellow('Address:    ') + chalk.bold(identity.account.address.plain())
            + '\n\t' + chalk.yellow('PublicKey:  ') + chalk.bold(chalk.green(identity.account.publicKey.toString()))
            + '\n\t' + chalk.yellow('PrivateKey: ') + chalk.bold(chalk.red(identity.account.privateKey.toString()))
            + '\n';

        });
        console.log(message);
    }

    public readArguments(options: CommandOptions): any {
        let name = OptionsResolver(options, 
            'name',
            () => { return ''; },
            'Enter an identity name (Leave empty for any): ');

        if (!name.length) {
            name = 'default';
        }

        let scopeName = OptionsResolver(options, 
            'scope',
            () => { return ''; },
            'Enter the scope name (Leave empty for any): ');

        return {
            name,
            scopeName,
        };
    }
}
