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
// third-party dependencies
import chalk from 'chalk';
import {command, ExpectedError, metadata, option, ValidationContext, Validator} from 'clime';
import {
    NetworkType,
} from 'nem2-sdk';

// internal dependencies
import {
    OptionsResolver
} from '../../core/Options';
import {Action, BaseOptions} from '../../core/Action';
import {BootstrapRepository} from '../../core/repositories/BootstrapRepository';
import {IdentityRepository} from '../../core/repositories/IdentityRepository';
import {CatapultService} from '../../core/services/CatapultService';
import {IdentityService} from '../../core/services/IdentityService';

export class NetworkValidator implements Validator<string> {
    validate(value: string, context: ValidationContext): void {
        if (!(value === 'MIJIN' || value === 'MIJIN_TEST' || value === 'MAIN_NET' || value === 'TEST_NET')) {
            throw new ExpectedError('Please enter a valid network type');
        }
    }
}
export class CommandOptions extends BaseOptions {
    @option({
        flag: 'p',
        description: 'Enter the absolute path (full path) to your catapult-service-bootstrap installation: ',
    })
    path: string;

    @option({
        flag: 'n',
        description: 'Network Type: MAIN_NET, TEST_NET, MIJIN, MIJIN_TEST',
        validator: new NetworkValidator(),
    })
    network: string;

    @option({
        flag: 'u',
        description: 'Enter the URL of the catapult node (Ex.: http://localhost:3000): ',
    })
    url: string;

    getNetwork(network: string): NetworkType {
        if (network === 'MAIN_NET') {
            return NetworkType.MAIN_NET;
        } else if (network === 'TEST_NET') {
            return NetworkType.TEST_NET;
        } else if (network === 'MIJIN') {
            return NetworkType.MIJIN;
        } else if (network === 'MIJIN_TEST') {
            return NetworkType.MIJIN_TEST;
        }

        return NetworkType.MIJIN_TEST;
    }
}

@command({
    description: 'Import your private network nemesis accounts Identities.',
})
export default class extends Action {
    private catapultService: CatapultService;
    private identityService: IdentityService;

    constructor() {
        super();

        const identityRepository = new IdentityRepository('.nem2-business.json');
        this.identityService = new IdentityService(identityRepository);
    }

    @metadata
    async execute(options: CommandOptions) 
    {
        // read parameters
        const {
            path,
            networkType,
            url,
        } = this.readArguments(options);

        // initialize catapult-service-bootstrap installation reader
        const boostrapRepository = new BootstrapRepository(path, networkType);
        this.catapultService = new CatapultService(boostrapRepository);

        try {
            const identity = this.identityService.findIdentityByName('network.nemesis');

            // print identity and quit (already imported)
            console.log('\n' + identity.toString() + '\n');
            return ;
        }
        catch(e) {} // identity `network.nemesis` does not exist yet

        // read the first nemesis account
        const nemesisAccount = this.catapultService.getNemesisAccount();
        const identity = this.identityService.createNewIdentity(nemesisAccount, url, 'network.nemesis');

        // print identity and quit
        console.log('\n' + identity.toString() + '\n');
        return ;
    }

    public readArguments(options: CommandOptions): any {
        const path = OptionsResolver(options, 
            'path',
            () => { return ''; },
            'Enter the absolute path (full path) to your catapult-service-bootstrap installation: ');

        let url = OptionsResolver(options,
            'url',
            () => undefined,
            'Enter the URL of the catapult node (Default: http://localhost:3000): ');

        const networkType = options.getNetwork(OptionsResolver(options,
            'network',
            () => undefined,
            'Enter a network type (MIJIN_TEST, MIJIN, MAIN_NET, TEST_NET): '));

        if (!url.length) {
             url = 'http://localhost:3000';
        }
    
        return {
            path,
            networkType,
            url,
        };
    }
}
