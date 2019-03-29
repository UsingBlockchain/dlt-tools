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
import {BootstrapRepository} from '../repositories/BootstrapRepository';

/**
 * Class `CatapultService` provides basic catapult installation 
 * diagnostics features.
 * 
 * @since 0.2.0
 */
export class CatapultService {
    /**
     * The repository instance
     * 
     * @var {BootstrapRepository}
     */
    private readonly bootstrapRepository: BootstrapRepository;

    constructor(bootstrapRepository: BootstrapRepository) {
        this.bootstrapRepository = bootstrapRepository;
    }

    getNemesisAccount(index: number = 0) {
        const accounts = this.bootstrapRepository.readAddresses().nemesisAddresses;

        if (index >= accounts.length) {
            throw new Error('Could not find a nemesis account with index: ' + index);
        }

        return accounts[index];
    }

}
