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
import {
    UInt64
} from 'nem2-sdk';

/**
 * Class `Asset` describes a crypto currency asset
 * amount.
 *
 * Objects of this class describe crypto currency
 * amounts.
 * 
 * @since 0.0.1 
 */
export class Asset {
    /**
     * Construct an `Asset` object.
     * 
     * @param amount 
     * @param ticker 
     */
    constructor(
        /**
         * The asset amount
         * @var {UInt64}
         */
        public readonly amount: UInt64,

        /**
         * The asset name (NEM2 namespace)
         * @var {string}
         */
        public readonly currency: string,
    ) {}

    /**
     * Construct an `Asset` object from a `input` string.
     * 
     * The `input` argument must contain an amount and
     * a currency ticker separated by a space.
     * 
     * @param   input     {string}
     * @return  {Asset}
     */
    public static fromString(
        input: string,
        divisibility: number
    ): Asset {
        // crypto currency asset amount provided
        const [amount, currency] = input.split(' ');

        // format amount to uint64
        let relative = parseFloat(amount);
        let absolute = relative * Math.pow(10, divisibility);
        let uint64_amt = UInt64.fromUint(absolute);

        return new Asset(uint64_amt, currency);
    }
}
