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
        flag: 'n',
        description: 'name',
    })
    name: string;
}

@command({
    description: 'Remove an identity by name',
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
            name,
        } = this.readArguments(options);

        // get the nemesis account
        const identity = this.identityService.findIdentityByName(name);

        // remove the identity
        this.identityService.removeIdentity(name);

        console.log('Identity ' + name + ' removed successfully.');
    }

    public readArguments(options: CommandOptions): any {
        let name = OptionsResolver(options, 
            'name',
            () => { return ''; },
            'Enter an identity name: ');

        if (!name.length) {
            name = 'default';
        }

        return {
            name,
        };
    }
}
