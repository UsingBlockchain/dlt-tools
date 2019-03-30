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
import {Identity} from './Identity';

/**
 * Class `Scope` describes a scope to group identities,
 * namespaces, assets and business logic.
 * 
 * @since 0.2.0
 */
export class Scope {

    constructor(/**
                 * Name of the scope
                 * @var {string}
                 */
                public readonly name: string,
                /**
                 * The identities linked to this scope
                 * @var {Identity[]}
                 */
                public readonly identities: Identity[] = []) {

    }
}
