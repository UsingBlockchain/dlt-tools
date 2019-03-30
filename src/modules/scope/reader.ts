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

// internal deps
import {
    OptionsResolver
} from '../../core/Options';
import {Action, BaseOptions} from '../../core/Action';
import {IdentityRepository} from '../../core/repositories/IdentityRepository';
import {IdentityService} from '../../core/services/IdentityService';

export class CommandOptions extends Options {
    @option({
        flag: 's',
        description: 'Scope name',
    })
    scope: string;
}

@command({
    description: 'Display information about a Scope',
})

export default class extends Command {
    private readonly identityService: IdentityService;

    constructor() {
        super();
        const identityRepository = new IdentityRepository('.nem2-business.json');
        this.identityService = new IdentityService(identityRepository);
    }

    @metadata
    execute(options: CommandOptions) {

        // read parameters
        const {
            scopeName,
        } = this.readArguments(options);

        const cleanScope = scopeName.replace(/[^A-Za-z0-9\-_]+/g, '');
        const ownerIdentity = this.identityService.findIdentityByScopeAndName(cleanScope, 'owner');
        const scope = this.identityService.findScope(cleanScope);

        let message = '';
        message += '\n' + chalk.yellow('Scope Name:       ') + chalk.bold(cleanScope);
        message += '\n' + chalk.yellow('Owner Address:    ') + chalk.bold(ownerIdentity.account.address.plain());
        message += '\n' + chalk.yellow('Owner Public Key: ') + chalk.bold(ownerIdentity.account.publicKey.toString());
        message += '\n\nIdentities';
        message += '\n----------';

        // browse identities by scope
        scope.identities.map((identity) => {

            const identityName = identity.name;
            const addressAlias = cleanScope + '.identities.' + identityName;
            const mosaicAlias  = cleanScope + '.names.' + identityName;

            message += '\n' + chalk.green(identityName) + '-->';
            message += '\n\t' + chalk.yellow('Address:         ') + chalk.bold(identity.account.address.plain()); 
            message += '\n\t' + chalk.yellow('Public Key:      ') + chalk.bold(identity.account.publicKey.toString()); 
            message += '\n\t' + chalk.yellow('Address Alias:   ') + chalk.bold(addressAlias); 
            message += '\n\t' + chalk.yellow('Mosaic Alias:    ') + chalk.bold(mosaicAlias);
            message += '\n';
        });

        console.log(message);
    }

    public readArguments(options: CommandOptions): any {
        let scopeName = OptionsResolver(options, 
            'scope',
            () => { return ''; },
            'Enter a scope name: ');

        return {
            scopeName,
        };
    }
}
