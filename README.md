# cplace Typescript Refactoring

## Motivation
Our typescript codebase is(not any more) organised using namespace/modules. While everything works fine, for large project like cplace, it can be tedious to write and maintain typescript codebase.
Using modules also makes it difficult to identify dependencies between components and different plugins. 

The javascript community has adopted ES6 import/export mechanism as the defacto way to organize typescript/javascript projects, our refactoring initiative will keep us up-to-date with the current trend. Moreover most of the new tools work either only or better with ES6 style import/export mechanism.   
Also, IntelliJ support for module based code is not good and it does not provide proper autocomplete.      

We believe that ES6 style import/expots will provide more flexibility in the way we write our frontend code and will be easier to maintain.

## What will change
Lets assume following is our current code

// MyCtrl.ts
```typescript
module cf.cplace.myPlugin {
    
    class MyCtrl {
        static CTRL_NAME = 'cf.cplace.myPlugin.MyCtrl';
        
        constructor(public scope: ng.IScope){}
        
        method1(widgetCtrl: cf.cplace.platform.widgetLayout.WidgetCtrl) { /* 1 */
        }
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
            controller: MyCtrl.CTRL_NAME, /* 2 */
           ...
        }
    }
    
    angular.module('cf.cplace.myPlugin')
    .directive('myDirective', myDirective);
}    
```

This code will be refactored to 

 // MyCtrl.ts
```typescript
import {WidgetCtrl} from '@cf.cplace.platform/widgetLayout/widgetCtrl';
import {IScope} from 'angular';

export class MyCtrl {
    static CTRL_NAME = 'cf.cplace.myPlugin.MyCtrl';
    
    constructor(public scope: IScope){}
    
    method1(widgetCtrl: WidgetCtrl) {}
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


// app.ts
```typescript
import {MyCtrl} from './MyCtrl';
import {myDirective} from './myDirective';

const MyAngularModule = angular
    .module('cf.cplace.myPlugin')
    .controller(MyCtrl.CTRL_NAME, MyCtrl);
    .directive('myDirective', myDirective);
    .name;
    
export default MyAngularModule;
```

As we can see in the old code `MyCtrl` depends on `WidgetCtrl`(1) from platform and `myDirective` depends on `MyCtrl`(2) but this relationship is not evident from the code itself.
Moreover if a cplace plugin depends on other cplace plugins, there is no way to define this dependency relationship and anything can be accessed from anywhere.

The new refactored code makes relationship clear and evident while reading the code.    


## Prerequisites

1. Install typescript refactor script using `npm i -g @cplace/ts-refactor`
2. Ensure the new assets compiler `cplace-asc` is installed: `npm i -g @cplace/asc`
3. Ensure every plugin has an `app.ts` file that needs to be the entry point. Any code you want to use has to be reachable<sup>*</sup> by imports from that file.

<sub> * Not all files have to be imported into app.ts but all files should be reachable transitively.</sub>  


## Refactoring Procedure

The general refactoring procedure to transform your TypeScript sources is as follows:

1. Ensure the `main` repository is in the appropriate branch with already refactored TypeScript sources<br>
    If you have other repository dependencies those need to be already refactored, too.
    
2. Run `cplace-asc -c` in *every* repository that your repository depends on (at least `main`).
    
3. Adapt the repository's `.gitignore` file to include these lines:<br>
    ```
    ts-old/
    tsconfig.json
    ```
    If any plugins to be refactored already has tsconfig.json file, delete them. 

4. Also the following two changes need to be made to the repository's `.circleci/config.yml` file - 

   1. Replace `command: nvm install 6.1 && nvm alias default 6.1` with `command: nvm install 8.11.2 && nvm alias default 8.11.2`
   
   2.  Add `- run: npm install -g @cplace/asc`  just above the line `- run: npm install -g @cplace/cli`

5. Run `cplace-ts-refactor` (or on *nix better: `cplace-ts-refactor | tee refactor.log`). The old `ts` source files will be copied to `assets/ts-old` for later reference.

6. See the generated output for `WARN` messages and the **Known Issues** listed below.

7. Open IntelliJ and in the Project View on the left for every plugin in your repository:
    1. Select the plugin's `assets/ts` folder.
    2. Right-click the folder and select *Reformat Code*
    
8. Fix any issues detected in step 5.

9. If your code uses old http promise API, refactor it to new Promise API. eg. <br> 
`this.$http.get(someUrl).success((data) => {}).error((data) => {}) ` will be refactored to <br> 
`this.$http.get(someUrl).then((response: IHttpResponse<yourReturnType or any>) => {response.data...}, (response) => {})` <br>
Notice that in new promise API data is not directly available, instead it is part of response object. 

10. The refactor script might miss some angular declarations and will not add them to `app.ts` file. <br>
    Just go through all directives/controllers/services etc and make sure they are declared in your `app.ts`  

11. Make sure you have the new assets compiler installed (`cplace-asc`). Test the refactored changes by running `cplace-asc -c` and starting your cplace server.

## Known Issues

The following aspects **must** be cleaned up manually afterwards:

- If you use `underscore` in your files you have to add the following import to every file using it: `import * as _ from 'underscore'`
- If you use `moment` in your files you have to add the following import to every file using it: `import * as moment from 'moment'`
- If you use `lang.message` or `lang.parameterizedMessage` in your files you have to remove `lang.` and import the `message`/`parameterizedMessage` functions directly
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


## FAQs

#### I followed all the steps properly but I still cannot get my typescript to compile/bundle.

Make sure you do not have any circular references in your codebase. We use webpack to bundle the compiled typescript code and webpack cannot handle circular references. 
If typescript compilation is failing, read log messages generated by the assets compiler they are quite descriptive.

#### Code compiles but IntelliJ still shows errors.

Sometimes intelliJ fails to sync when there are too many changes at once. Goto View > Tool windows > Typescript and restart typescript service. This window also lists all the errors in your typescript project.

#### I ran the refactor script nothing happened script exited without any output

Make sure that plugin you are trying to refactor does not already have `tsconfig.json`, if its there then delete it and try again.

#### I have some code written in javascript that uses platform references eg. (cf.cplace.platform.widgetLayout.widgetCtrl), this does not work any more. How do I access code defined in typescript from outside?

For common features we provide global bindings like `lang.message(pluginId, messageId)`. You can check the list provided globals in `ts/global` folder in platform codebase. Accessing code that is not provided as globals by default can be done as follows: 
* Replace dots with underscore in plugin identifier
* Prepend `$`, use this name as the require function
* Provide relative path to the file from which you want to access some object. The path is relative to `assets/ts` folder and MUST end with `.js`.
* Access exported variables/function/objects

eg.
1) access `widgetCtrl` from `platform`  - `$cf_cplace_platform('./widgetLayout/controllers/WidgetCtrl.js').WidgetCtrl`
2) access some event name from `projektplanung` - `$cf_cplace_projektplanung('./detailsViewModels.js').events`


    
