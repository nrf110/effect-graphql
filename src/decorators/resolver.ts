import { isTag } from 'effect/Context'
import { inputArgsMetadataKey } from './metadata-keys'

export function Resolver<T>(of: () => T): ClassDecorator {
    return (target: Object) => {
        if (isTag(target)) {
            target.Service
        }

        throw new Error('Resolver must be a Tag')        
    }
}

export function Resolve(): MethodDecorator {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const method = descriptor.value

        descriptor.value = function(...args: unknown[]): unknown {
            let typedArgs = Reflect.getOwnMetadata(inputArgsMetadataKey, target, propertyKey)
            if (typedArgs) {
                const validatedArgs = Array.from(arguments).map((arg, index) => {
                    let typedArg = typedArgs[index]
                    if (typedArg) {
                        return typedArg.decode(arg)
                    }
                    return arg
                })
                return method.apply(this, validatedArgs)
            }
        }        
    }
}