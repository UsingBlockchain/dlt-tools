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
import {Spinner} from 'cli-spinner';
import {Command, ExpectedError, option, Options} from 'clime';

// internal deps
import {Action} from './Action';
import {Identity} from './models/Identity';
import {IdentityRepository} from './repositories/IdentityRepository';
import {IdentityService} from './services/IdentityService';

/**
 * Class `AuthenticatedAction` describes an authenticated command line action.
 * 
 * @since 0.2.0
 */
export abstract class AuthenticatedAction extends Action {
    /**
     * 
     */
    protected readonly identityService: IdentityService;

    constructor() {
        super();

        const identityRepository = new IdentityRepository(this.config.storageFile);
        this.identityService = new IdentityService(identityRepository);
    }

    /**
     * Get an identity by name. If the `--scope` options is set,
     * a scoped identity will be returned.
     * 
     * @param options
     */
    public getIdentity(options: IdentityOptions): Identity {
        const identityName = options.identity ? options.identity : 'default';
        const scopeName = this.getScope(options);

        try {
            const identity = this.identityService.findIdentityByScopeAndName(scopeName, identityName);
            return identity;
        } catch (err) {
            console.log(err);
            throw new ExpectedError(options.identity ? ('No identity found with scope: ' + scopeName + ' and name: ' + identityName) :
                'To start using the nem2-tools suite, create a default identity using: nem2-tools identity create');
        }
    }

    /**
     * Get a `--scope` cleaned name.
     * 
     * @param options
     */
    public getScope(options: IdentityOptions): string {
        const scope = options.scope || 'default';
        return scope.replace(/[^A-Za-z0-9\-_]+/g, '');
    }
}

export class IdentityOptions extends Options {
    @option({
        flag: 's',
        description: 'Scope name',
    })
    scope: string;

    @option({
        flag: 'i',
        description: 'Select between your identities, by providing a name',
    })
    identity: string;
}
