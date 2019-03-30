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
import {Command, command, metadata, option, Options, ExpectedError} from 'clime';

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
    description: 'Remove an identity by name',
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

        // retrieve the identity
        const identity = this.identityService.findIdentityByScopeAndName(scopeName, name);

        // remove the identity
        this.identityService.removeIdentity(identity.getSlug());

        console.log('Identity ' + identity.getSlug() + ' removed successfully.');
    }

    public readArguments(options: CommandOptions): any {
        let name = OptionsResolver(options, 
            'name',
            () => { return ''; },
            'Enter an identity name: ');

        if (!name.length) {
            throw new ExpectedError('Please specify an identity name.');
        }

        let scopeName = OptionsResolver(options, 
            'scope',
            () => { return ''; },
            'Enter the scope name: ');

        if (!scopeName.length) {
            throw new ExpectedError('Please specify a scope name.');
        }

        return {
            name,
            scopeName,
        };
    }
}
