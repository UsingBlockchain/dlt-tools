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
import * as Path from 'path';
import * as fs from 'fs';

/**
 * Class `Bootstrap` configures the application by
 * loading the configuration in `conf/bios.json`.
 * 
 * @since 0.0.1
 */
export class Bootstrap {

    /**
     * Configuration object
     * @var {Object}
     */
    protected config: Object;

    constructor() {
        const confPath = Path.join(__dirname, '../../config') + '/app.json';
        const config = fs.readFileSync(confPath);

        // read config
        try {
            this.config = JSON.parse(config.toString());
        }
        catch (e) { 
            console.error('JSON error in ' + confPath + ' : ', e);
            this.config = {}; 
        }
    }

    public getConfig(): any {
        return this.config;
    }
}
