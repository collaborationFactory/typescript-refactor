# Cplace Typescript Refactor

**Configuration** (refactor.config)

Config file should be in the directory where the script is executing or absolute path of config file should be provided. 
```json
{
  // verbose logging
  "verbose": true,
  // plugins to refactor
  "plugins": ["plugin1", "plugin2"],
  // if true module.ts file will be created at appropriate location 
  "createModuleFiles": false,
  // resolve imports where possible
  "addImports": false,
  // add export to top level functions, classes and const declarations  
  "addExports": false,
  // remove module prefixes eg. cf.cplace.platform.widgetLayout.CPLACE_WIDGET_DIRECTIVE 
  // will be replaced with CPLACE_WIDGET_DIRECTIVE with import statement for the same.    
  "referencesToReplace": ["cf.cplace.platform"]  
}
```

All the options can be overridden via commandline options

* -verbose
* -plugins plugin1,plugin2
* -config /absolute/path/of/refactor.config

 
 
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

**Only files listed in tscommand.txt will be considered for refactoring.**

If the script is executed from main folder then all modules will be refactored.
If the script is executed inside of a module directory then only that module will be refactored
  
 
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
