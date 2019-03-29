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
import * as yaml from 'read-yaml';
import {
    Account,
    NetworkType,
} from 'nem2-sdk';

export class NemesisGeneratedAddresses {
    public readonly peerNodes: Account[] = [];
    public readonly apiNodes: Account[] = [];
    public readonly restGateways: Account[] = [];
    public readonly nemesisAddresses: Account[] = [];
}

/**
 * Class `BootstrapRepository` provides bootstrap-service 
 * installation management features.
 * 
 * @since 0.2.0
 */
export class BootstrapRepository {

    /**
     * 
     */
    protected static accounts: NemesisGeneratedAddresses = new NemesisGeneratedAddresses();

    /**
     * Object containing configuration file paths
     * for several catapult services when using the
     * catapult-service-bootstrap docker images.
     * 
     * @see https://github.com/nemtech/catapult-service-bootstrap
     */
    protected static paths = {
        generatedAddresses: 'build/generated-addresses/addresses.yaml',
        catapultRest: 'build/catapult-config/rest-gateway-0/userconfig/rest.json',
        catapultServer: {
            'api-node-0': {
                'path': 'build/catapult-config/api-node-0/userconfig/resources/',
                'boot': 'config-user.properties',
                'api': 'peers-api.json',
                'p2p': 'peers-p2p.json',
            },
            'peer-node-0':  {
                'path': 'build/catapult-config/peer-node-0/userconfig/resources/',
                'boot': 'config-user.properties',
                'api': 'peers-api.json',
                'p2p': 'peers-p2p.json',
            },
            'peer-node-1':  {
                'path': 'build/catapult-config/peer-node-1/userconfig/resources/',
                'boot': 'config-user.properties',
                'api': 'peers-api.json',
                'p2p': 'peers-p2p.json',
            }
        }
    };

    constructor(private readonly installPath: string, private readonly networkType: NetworkType = NetworkType.MIJIN_TEST) {
        if (! fs.existsSync(installPath)) {
            throw new Error("Installation path for 'catapult-bootstrap-service' does not exist with: " + installPath);
        }

        const accountsConfigPath = installPath + '/' + BootstrapRepository.paths.generatedAddresses;
        if (! fs.existsSync(accountsConfigPath)) {
            throw new Error("Installation path for 'catapult-bootstrap-service' is not compatible with this package, at: " + installPath);
        }
    }

    readAddresses(): NemesisGeneratedAddresses {
        const addressesPath = this.installPath + '/' + BootstrapRepository.paths.generatedAddresses;
        const addresses = yaml.sync(addressesPath);

        for (const group of Object.keys(addresses)) {
            const privateKeys = addresses[group].map((keypair) => {
                return keypair.private;
            });

            if ('peer_nodes' === group) {
                privateKeys.map((privKey) => {
                    BootstrapRepository.accounts.peerNodes.push(Account.createFromPrivateKey(privKey, this.networkType));
                });
            } else if ('api_nodes' === group) {
                privateKeys.map((privKey) => {
                    BootstrapRepository.accounts.apiNodes.push(Account.createFromPrivateKey(privKey, this.networkType));
                });
            } else if ('rest_gateways' === group) {
                privateKeys.map((privKey) => {
                    BootstrapRepository.accounts.restGateways.push(Account.createFromPrivateKey(privKey, this.networkType));
                });
            } else if ('nemesis_addresses' === group) {
                privateKeys.map((privKey) => {
                    BootstrapRepository.accounts.nemesisAddresses.push(Account.createFromPrivateKey(privKey, this.networkType));
                });
            }
        }

        return BootstrapRepository.accounts;
    }
}
