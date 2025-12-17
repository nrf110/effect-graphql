import { Schema } from 'effect'
import 'reflect-metadata'
import { inputArgsMetadataKey } from './metadata-keys'


type ArgOptions = {
    name?: string
    schema: Schema.Schema<any, any, never>
}

export function Arg(options: ArgOptions): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol | undefined, index: number): void {
        if (!propertyKey) {
            throw new Error('InputArg can only be used as a parameter decorator')
        }
        let existingParams = Reflect.getOwnMetadata(inputArgsMetadataKey, target, propertyKey) || {}
        existingParams[index] = {
            name: options.name,
            decode: (value: unknown) => Schema.decodeUnknown(options.schema)(value)
        }
        Reflect.defineMetadata(inputArgsMetadataKey, existingParams, target, propertyKey)
    }
}

export function Root(): ParameterDecorator {
    return function(target: Object, propertyKey: string | symbol | undefined, index: number): void {
        if (!propertyKey) {
            throw new Error('Root can only be used as a parameter decorator')
        }
        let existingParams = Reflect.getOwnMetadata(inputArgsMetadataKey, target, propertyKey) || {}
        existingParams[index] = {
            name: propertyKey,
            decode: (value: unknown) => value
        }
        Reflect.defineMetadata(inputArgsMetadataKey, existingParams, target, propertyKey)
    }
}