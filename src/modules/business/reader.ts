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
        flag: 'b',
        description: 'Business name',
    })
    business: string;
}

@command({
    description: 'Display information about a Business',
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
            business,
        } = this.readArguments(options);

        const cleanName = business.replace(/[^A-Za-z0-9\-_]+/g, '');
        const businessKeyName   = 'business-' + cleanName;
        const businessIdentity  = this.identityService.findIdentityByName(businessKeyName);

        let message = '';
        message += '\n' + chalk.yellow('Business Name:       ') + chalk.bold(cleanName);
        message += '\n' + chalk.yellow('Business Address:    ') + chalk.bold(businessIdentity.account.address.plain());
        message += '\n' + chalk.yellow('Business Public Key: ') + chalk.bold(businessIdentity.account.publicKey.toString());
        message += '\n\nIdentities';
        message += '\n----------';

        this.identityService.findAll().map((identity) => {

            const isFromBusiness = 0 === identity.name.indexOf(businessKeyName + '-');
            const isBusinessAcct = businessIdentity.name === identity.name;
            const identityName = isFromBusiness ? identity.name.replace(businessKeyName + '-', '') : identity.name;

            if (isFromBusiness) {
                message += '\n' + chalk.green(identityName) + '-->';
                message += '\n\t' + chalk.yellow('Address:         ') + chalk.bold(identity.account.address.plain()); 
                message += '\n\t' + chalk.yellow('Public Key:      ') + chalk.bold(identity.account.publicKey.toString()); 
                message += '\n\t' + chalk.yellow('Address Alias:   ') + chalk.bold(cleanName + '.identities.' + identityName); 
                message += '\n\t' + chalk.yellow('Mosaic Alias:    ') + chalk.bold(cleanName + '.names.' + identityName);
                message += '\n';
            } else {
                return ;
            }
        });

        console.log(message);
    }

    public readArguments(options: CommandOptions): any {
        let business = OptionsResolver(options, 
            'business',
            () => { return ''; },
            'Enter a business name: ');

        return {
            business,
        };
    }
}
