# cplace Typescript Refactoring

## Prerequisites

1. Ensure the new assets compiler `cplace-asc` is installed: `npm i -g @cplace/asc`
2. Ensure every plugin has an `app.ts` file that needs to be the entry point. Any code you want to use has to be "reachable" by imports from that file.


## Refactoring Procedure

The general refactoring procedure to transform your TypeScript sources is as follows:

1. Ensure the `main` repository is in the appropriate branch with already refactored TypeScript sources<br>
    If you have other repository dependencies those need to be already refactored, too.
    
2. Adapt the repository's `.gitignore` file to include these lines:<br>
    ```
    ts-old/
    tsconfig.json
    ```
    
3. Run `cplace-ts-refactor` (or on *nix better: `cplace-ts-refactor | tee refactor.log`). The old `ts` source files will be copied to `assets/ts-old` for later reference.

4. See the generated output for `WARN` messages and the **Known Issues** listed below.

5. Open IntelliJ and in the Project View on the left for every plugin in your repository:
    1. Select the plugin's `assets/ts` folder.
    2. Right-click the folder and select *Reformat Code*
    
6. Fix any issues detected in step 4.

7. Make sure you have the new assets compiler installed (`cplace-asc`).

8. Test the refactored changes by running `cplace-asc -c` and starting your cplace server.

## Known Issues

The following aspects **must** be cleaned up manually afterwards:

- If you use `underscore` in your files you have to add the following import to every file using it: `import * as _ from 'underscore'`
- If you use `angular.module(...).config(...)` or `angular.module(...).run(...)` must add those functions again after refactoring
- If you use `angular.module(...).directive(DIRECTIVE, directiveFunctionRefernce)`, i.e. you use a constant to specify the directive name without properly exporting it as a unique name you have to replace `DIRECTIVE` with the proper value

## Usage

The tool has to be executed inside the root of a (sub-)repository directly.
```
$ cplace-ts-refactor --help
Script for refactoring cplace typescript files

Available options:
   -verbose                    Verbose logging
   -plugins plugin1,plugin2    List of plugins to refactor
   -noModuleFiles              Do not create files that defines angular module and all related functions(directives, controllers, ...)
   -noImports                  Do not try to resolve reference error and add import statements if possible
   -noExports                  Do not add export keyword to all top level functions, classes and interfaces of a refactored file
```

Your typical usage should not require any arguments at all - to refactor all plugins inside a repository just use:
```
$ cplace-ts-refactor
```

On *nix systems we recommend the following to also capture the log output into a file:
```
$ cplace-ts-refactor | tee refactor.log
```

All generated log output will then be captured inside `refactor.log`.

During execution the script will output `WARN` messages if there are problems with automatic migration. **You have to manually inspect all files listed there afterwards**.




<!--
#### Old Stuff
 
Our directory structure for typescript files is
```
cf.cplace.plugin
-- assets
---- ts
------ dir1
------ dir2
------ file1.ts
------ file2.ts
------ tscommand.txt
```  
 
// MyCtrl.ts
```typescript
module cf.cplace.myPlugin {
    
    class MyCtrl {
        constructor(){}
        
        method1() {}
    }
    
    angular.module('cf.cplace.myPlugin')
    .controller('cf.cplace.myPlugin.MyCtrl', MyCtrl);
}    
```
// MyDirective.ts
```typescript
module cf.cplace.myPlugin {
    
    
    function myDirective() {
        return {
            controller: MyCtrl.CTRL_NAME
           ...
        }
    }
    
    angular.module('cf.cplace.myPlugin')
    .directive('myDirective', myDirective);
}    
```


**Will be refactored to**


 // MyCtrl.ts
```typescript
export class MyCtrl {
    static CTRL_NAME = 'cf.cplace.myPlugin.MyCtrl';
    
    constructor(){}
    
    method1() {}
}
```

// MyDirective.ts
```typescript
import {MyCtrl} from './MyCtrl';

export function myDirective() {
    return {
       controller: MyCtrl.CTRL_NAME
        ...
    }
}
```


**!! DESCRIBE MORE**
a new file will be created if it doesnt exists yet
// module.ts
```typescript
import {MyCtrl} from './MyCtrl';
import {myDirective} from './myDirective';

export const angular
    .module('cf.cplace.myPlugin')
    .controller(MyCtrl.CTRL_NAME, MyCtrl);
    .directive('myDirective', myDirective);
    .name;
```
-->
