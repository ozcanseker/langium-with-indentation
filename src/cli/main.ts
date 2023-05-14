import chalk from 'chalk';
import { Command } from 'commander';
import { ModelRoot } from '../language/generated/ast';
import { createHelloWorldServices } from '../language/hello-world-module';
import { extractAstNode } from './cli-util';
import { NodeFileSystem } from 'langium/node';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createHelloWorldServices(NodeFileSystem).HelloWorld;
    const model = await extractAstNode<ModelRoot>(fileName, services);
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        .version(require('../../package.json').version);
}
