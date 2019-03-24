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
import * as readlineSync from 'readline-sync';
import {
    Mosaic,
    MosaicId,
    NamespaceId,
    UInt64,
} from 'nem2-sdk';
import { uint64 as uint64_t } from 'nem2-library';

// internal deps
import { Asset } from './Asset';

/**
 * Generic command line argument reader.
 * 
 * @param options 
 * @param key 
 * @param secondSource 
 * @param promptText 
 * @param readlineDependency
 * @return {any}
 */
export const OptionsResolver = (
    options: any,
    key: string,
    secondSource: () => string | undefined,
    promptText: string,
    readlineDependency?: any
): any => {
    const readline = readlineDependency || readlineSync;
    return options[key] !== undefined ? options[key] : (secondSource() 
        || readline.question(promptText));
};

/**
 * Read a `uint64` command line argument.
 * 
 * @param options 
 * @param key 
 * @param secondSource 
 * @param promptText 
 * @param readlineDependency 
 * @return {UInt64 | null}
 */
export const UInt64OptionsResolver = (
    options: any,
    key: string,
    secondSource: () => string | undefined,
    promptText: string,
    readlineDependency?: any
): UInt64 | null => {
    const readline = readlineDependency || readlineSync;
    const result = options[key] !== undefined ? options[key] : (secondSource() 
                || readline.question(promptText));

    if (result.indexOf('[') === 0) {
        let asArray: Array<number> = JSON.parse(result);
        return new UInt64(asArray);
    }

    // check for numbers-only
    if (! /[0-9]+/.test(result)) {

        // not numbers-only, maybe hexadecimal?
        if (/[0-9A-Fa-f]+/.test(result)) {
            return new UInt64(uint64_t.fromHex(result));
        }

        // parsing error
        return null;
    }

    const asInt = parseInt(result);
    return UInt64.fromUint(asInt);
};

/**
 * Read a `mosaic` command line argument.
 * 
 * @param options 
 * @param key 
 * @param secondSource 
 * @param promptText 
 * @param readlineDependency 
 * @return {MosaicId|NamespaceId}
 */
export const MosaicOptionsResolver = (
    options: any,
    key: string,
    secondSource: () => string | undefined,
    promptText: string,
    readlineDependency?: any
): MosaicId | NamespaceId | Mosaic => {
    const readline = readlineDependency || readlineSync;
    const result = options[key] !== undefined ? options[key] : (secondSource() 
                || readline.question(promptText));

    // amount + mosaic name provided
    if (/[0-9]+ [0-9a-zA-Z\.\-_]+/.test(result)) {
        const [amount, mosaic] = result.split(' ');
        let uint64_amt = UInt64OptionsResolver(options, 'amount', () => { return amount; }, '');

        if (uint64_amt === null) {
            // invalid amount, could not be parsed.
            uint64_amt = UInt64.fromUint(0);
        }

        return new Mosaic(new NamespaceId(mosaic), uint64_amt);
    }

    // check for numbers-only
    if (! /[0-9]+/.test(result)) {

        // not numbers-only, maybe hexadecimal?
        if (/[0-9A-Fa-f]+/.test(result)) {
            return new MosaicId(uint64_t.fromHex(result));
        }

        // namespace name provided
        return new NamespaceId(result);
    }

    const asInt = parseInt(result);
    return new MosaicId(uint64_t.fromUint(asInt));
};

/**
 * Read an `asset amount` command line argument.
 * 
 * This can describe any NEM mosaic amount and name or amounts
 * and other crypto currencies available in the registry.
 * 
 * **Crypto Currency amounts** must be described with their
 * respective ticker (three letter acronym) in **uppercase**.
 *
 * @param options 
 * @param key 
 * @param secondSource 
 * @param promptText 
 * @param readlineDependency 
 * @return {MosaicId|NamespaceId}
 */
export const AssetAmountOptionsResolver = (
    options: any,
    key: string,
    secondSource: () => string | undefined,
    promptText: string,
    readlineDependency?: any
): MosaicId | NamespaceId | Mosaic | Asset => {
    const readline = readlineDependency || readlineSync;
    const result = options[key] !== undefined ? options[key] : (secondSource() 
                || readline.question(promptText));

    if (/[0-9]+ [0-9a-zA-Z\.\-_]+/.test(result)) {
        // NEM mosaic asset amount provided
        return MosaicOptionsResolver(options, key, () => { return result; }, '');
    }

    throw new Error('Input for amount is invalid with "' + result +'"');
};
