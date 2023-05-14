import { ValidationAcceptor, ValidationChecks } from 'langium';
import { HelloWorldAstType, ModelRoot} from './generated/ast';
import type { HelloWorldServices } from './hello-world-module';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: HelloWorldServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.HelloWorldValidator;
    const checks: ValidationChecks<HelloWorldAstType> = {
        ModelRoot: validator.testmodel
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class HelloWorldValidator {
    testmodel(model: ModelRoot, accept: ValidationAcceptor){
        let model2 = model;
        console.log(model2)
    }

}
