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
import {Account} from 'nem2-sdk';
import {Identity} from '../models/Identity';
import {Scope} from '../models/Scope';
import {IdentityRepository} from '../repositories/IdentityRepository';

/**
 * Class `IdentityService` provides basic identity management features.
 * 
 * @since 0.2.0
 */
export class IdentityService {
    private readonly identityRepository: IdentityRepository;

    constructor(identityRepository: IdentityRepository) {
        this.identityRepository = identityRepository;
    }

    createNewIdentity(account: Account, url: string, scope: string, name: string): Identity {
        return this.identityRepository.save(account, url, scope, name);
    }

    findScope(scope: string): Scope {
        const identities = this.findAll(scope);
        return new Scope(scope, identities);
    }

    findIdentityByScopeAndName(scope: string, name: string): Identity {
        return this.identityRepository.find(scope, name);
    }

    findAll(scope: string = 'default'): Identity[] {
        return this.identityRepository.all(scope);
    }

    removeIdentity(name: string): any {
        return this.identityRepository.remove(name);
    }

}
