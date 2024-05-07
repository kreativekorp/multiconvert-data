# MultiConvert Data
This repository contains source data for the [MultiConvert app](http://www.multiconvert.app).

## Building and Testing
To build and test the data files, you need Node.js and UglifyJS (`npm install uglify-js -g`). The build script `build.sh` will load and validate all data files, run all tests, and if no errors are encountered, produce minified data files.

	$ ./build.sh
	Compiling...
	194 unit types defined
	16 functions defined
	1194 units defined
	2659 units defined or included
	3 includes defined
	119 elements defined
	11 solvers or calculators defined
	0 errors in data
	0 warnings in data
	865 tests executed
	865 tests passed
	0 tests failed
	0 errors total
	0 warnings total
	Wrote mcdbmain.js
	Wrote mcdbmisc.js
	Minifying...
	-rw-rw-r-- 1 user group 189969 May  1 18:52 mcdbmain.js
	-rw-rw-r-- 1 user group 165284 May  1 18:52 mcdbmain.min.js
	-rw-rw-r-- 1 user group  30999 May  1 18:52 mcdbmisc.js
	-rw-rw-r-- 1 user group  26071 May  1 18:52 mcdbmisc.min.js
 	$

The minified data files are currently mostly useless to most people. If you are using this data in your own application, it is recommended to use the JSON source files for your own purposes and use the build script just for validation and testing.

## Example Unit Definitions

### Base Units
Consider the definition of the meter:

	"u0": {
		"symbol": "m",
		"name": {
			"en": {
				"1": "meter",
				"*": "meters"
			}
		},
		"dimension": {
			"length": 1
		}
	}

This is read as "`u0`, the meter, is the base unit for length."

### Derived Units Using Multiplication & Division
Consider the definition of the minute:

	"u100": {
		"symbol": "min",
		"name": {
			"en": {
				"1": "minute",
				"*": "minutes"
			}
		},
		"multiplier": 60,
		"dimension": {
			"time": 1
		}
	}

This is read as "`u100`, the minute, is 60 seconds (the base unit for time)."

Consider the definition of the liter:

	"u107": {
		"symbol": "L",
		"name": {
			"en": {
				"1": "liter",
				"*": "liters"
			}
		},
		"divisor": 1000,
		"dimension": {
			"length": 3
		}
	}

This is read as "`u107`, the liter, is one 1000th of a cubic meter (the base unit for length cubed, aka volume)."

Consider the definition of the knot:

	"u163": {
		"symbol": "kn",
		"name": {
			"en": {
				"1": "knot",
				"*": "knots"
			}
		},
		"multiplier": 1852,
		"divisor": 3600,
		"dimension": {
			"length": 1,
			"time": -1
		}
	}

This is read as "`u163`, the knot, is 1852/3600 meters per second (the base unit for length over time, aka velocity)."

### Derived Units Using Reversible Operations
Consider the definition of degrees Fahrenheit:

	"u900": {
		"symbol": "°F",
		"name": {
			"en": {
				"1": "degree Fahrenheit",
				"*": "degrees Fahrenheit"
			}
		},
		"instructions": "S32 M5 D9 A273.15",
		"dimension": {
			"temperature": 1
		}
	}

This is read as "to convert from `u900`, degrees Fahrenheit, to kelvin (the base unit for temperature), subtract 32, multiply by 5, divide by 9, and add 273.15." (To convert in the other direction, the instructions must of course be performed in reverse.)

The following instructions are allowed in the `instructions` field:

| instruction | operation      | formula                      | reverse operation |
| ----------- | -------------- | ---------------------------- | ----------------- |
| `A`*a*      | add            | *x'* = *x* + *a*             | `S`*a*            |
| `S`*a*      | subtract       | *x'* = *x* − *a*             | `A`*a*            |
| `Z`*a*      | subtract from  | *x'* = *a* − *x*             | `Z`*a*            |
| `M`*a*      | multiply       | *x'* = *x* × *a*             | `D`*a*            |
| `D`*a*      | divide         | *x'* = *x* ÷ *a*             | `M`*a*            |
| `G`*a*      | divide into    | *x'* = *a* ÷ *x*             | `G`*a*            |
| `P`*a*      | power          | *x'* = *x*<sup>*a*</sup>     | `R`*a*            |
| `R`*a*      | root           | *x'* = *x*<sup>1÷*a*</sup>   | `P`*a*            |
| `X`*a*      | exponential    | *x'* = *a*<sup>*x*</sup>     | `L`*a*            |
| `L`*a*      | logarithm      | *x'* = log<sub>*a*</sub> *x* | `X`*a*            |
| `E`*a*      | natural exp    | *x'* = e<sup>*x*</sup> − *a* | `N`*a*            |
| `N`*a*      | natural log    | *x'* = ln (*x* + *a*)        | `E`*a*            |
| `C`*a*      | circumference  | *x'* = *x* × π ÷ *a*         | `Q`*a*            |
| `Q`*a*      | diameter       | *x'* = *x* × *a* ÷ π         | `C`*a*            |
| `R2`        | `sqrt`         | *x'* = √*x*                  | `P2`              |
| `R3`        | `cbrt`         | *x'* = ∛*x*                  | `P3`              |
| `L2`        | `log2`         | *x'* = log<sub>2</sub> *x*   | `X2`              |
| `L10`       | `log10`        | *x'* = log<sub>10</sub> *x*  | `X10`             |
| `E0`        | `exp`          | *x'* = e<sup>*x*</sup>       | `N0`              |
| `E1`        | `expm1`        | *x'* = e<sup>*x*</sup> − 1   | `N1`              |
| `N0`        | `log`          | *x'* = ln *x*                | `E0`              |
| `N1`        | `log1p`        | *x'* = ln (*x* + 1)          | `E1`              |
| `C180`      | `toRadians`    | *x'* = *x* × π ÷ 180         | `Q180`            |
| `Q180`      | `toDegrees`    | *x'* = *x* × 180 ÷ π         | `C180`            |
| `F1`        | `sin`          | *x'* = sin *x*               | `V1`              |
| `F2`        | `cos`          | *x'* = cos *x*               | `V2`              |
| `F3`        | `tan`          | *x'* = tan *x*               | `V3`              |
| `F4`        | `cot`          | *x'* = cot *x*               | `V4`              |
| `F5`        | `sec`          | *x'* = sec *x*               | `V5`              |
| `F6`        | `csc`          | *x'* = csc *x*               | `V6`              |
| `F7`        | `sinh`         | *x'* = sinh *x*              | `V7`              |
| `F8`        | `cosh`         | *x'* = cosh *x*              | `V8`              |
| `F9`        | `tanh`         | *x'* = tanh *x*              | `V9`              |
| `F10`       | `coth`         | *x'* = coth *x*              | `V10`             |
| `F11`       | `sech`         | *x'* = sech *x*              | `V11`             |
| `F12`       | `csch`         | *x'* = csch *x*              | `V12`             |
| `V1`        | `asin`         | *x'* = sin<sup>−1</sup> *x*  | `F1`              |
| `V2`        | `acos`         | *x'* = cos<sup>−1</sup> *x*  | `F2`              |
| `V3`        | `atan`         | *x'* = tan<sup>−1</sup> *x*  | `F3`              |
| `V4`        | `acot`         | *x'* = cot<sup>−1</sup> *x*  | `F4`              |
| `V5`        | `asec`         | *x'* = sec<sup>−1</sup> *x*  | `F5`              |
| `V6`        | `acsc`         | *x'* = csc<sup>−1</sup> *x*  | `F6`              |
| `V7`        | `asinh`        | *x'* = sinh<sup>−1</sup> *x* | `F7`              |
| `V8`        | `acosh`        | *x'* = cosh<sup>−1</sup> *x* | `F8`              |
| `V9`        | `atanh`        | *x'* = tanh<sup>−1</sup> *x* | `F9`              |
| `V10`       | `acoth`        | *x'* = coth<sup>−1</sup> *x* | `F10`             |
| `V11`       | `asech`        | *x'* = sech<sup>−1</sup> *x* | `F11`             |
| `V12`       | `acsch`        | *x'* = csch<sup>−1</sup> *x* | `F12`             |

Instructions such as integer divide, modulus, comparisons, gamma function, etc. are not available because they cannot be performed in reverse.

Scientific notation uses the underscore (`_` instead of `E` or `e`) in the `instructions` field. An instruction such as `M2E3` will be interpreted as *x'* = e<sup>2*x*</sup>−3, not *x'* = 2000*x*. To get the latter, use the instruction `M2_3`.

### Derived Units Using JavaScript Functions ###
Consider the definition of the DIN #4 kinematic viscosity cup:

	"n144": {
		"symbol": "s",
		"name": {
			"en": {
				"1": "second (DIN #4)",
				"*": "seconds (DIN #4)"
			}
		},
		"parser": "function (a) { return (a*4.57-452/a)/100 }",
		"formatter": "function (a) { a *= 100; return (Math.sqrt(a*a+8263)+a)/9.14 }",
		"dimension": {
			"length": 2,
			"time": -1
		}
	}

This is read as "to convert from `n144`, seconds using DIN #4, to square meters per second (the base unit for kinematic viscosity), use the function `f(a)=(a*4.57-452/a)/100`; to convert in the other direction, multiply by 100, then use the function `f(a)=(sqrt(a*a+8263)+a)/9.14`."

The input to the `parser` function and the output of the `formatter` function need not be a number. Consider the definition of frequency described as musical pitch:

	"z1": {
		"name": {
			"en": "note"
		},
		"datatype": "text",
		"parser": [
			"function (a) {",
			"  if (a.trim) a = a.trim();",
			"  if (!a) return NaN;",
			"  var i='CCDDEFFGGAAB'.indexOf(a[0].toUpperCase());",
			"  if (i < 0) return NaN;",
			"  a = a.substring(1);",
			"  if (a.trim) a = a.trim();",
			"  while (a) {",
   			"    if (a[0] === '#' || a[0] === '\u266F') i++;",
			"    else if (a[0] === 'b' || a[0] === '\u266D') i--;",
			"    else if (a[0] !== '\u266E') break;"
   			"    a = a.substring(1);",
			"  }",
			"  if (a.trim) a = a.trim();",
			"  if (!a.length || !isFinite(a)) a=4;",
			"  return (27.5 * Math.pow(2, (a * 12 + i - 9) / 12));",
			"}"
		],
		"formatter": [
			"function (a) {",
			"  if (!(a=Math.abs(a)) || !isFinite(a)) return '';",
			"  var i = Math.round(Math.log(a / 27.5) * 12 / Math.log(2) + 9);",
			"  a = Math.floor(i / 12);",
			"  return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][i - 12 * a] + a;",
			"}"
		],
		"dimension": {
			"time": -1
		}
	}

The `"datatype": "text"` key-value pair indicates that the `parser` function takes a string and the `formatter` function returns a string. The `parser` and `formatter` functions in this example have been prettified for readability. Most functions in the actual data files are minimized.

It is generally recommended for JavaScript functions in unit definitions to use syntax as archaic as possible for maximum compatibility, hence the use of `function (a) { ... }` instead of `a => { ... }`, the check for `a.trim`, the use of `var` instead of `const` or `let`, the expression `Math.log(a / 27.5) * 12 / Math.log(2)` instead of `Math.log2(a / 27.5) * 12`, etc.

## Example Test Cases

### All Singing, All Dancing, All Inputs, All Outputs
Consider this (abbreviated) test case for length:

	{
		"name": "inches",
		"u0_-3": 254000,
		"u0_-2": 25400,
		"u0_-1": 2540,
		"u0": 254,
		"u0_1": 25.4,
		"u0_2": 2.54,
		"u0_3": 0.254,
		"u207_-6": 10000000000,
		"u207": 10000,
		"epsilon": 1E-12
	}

This test case states that 254000 millimeters (`u0_-3`), 25400 centimeters (`u0_-2`), 2540 decimeters (`u0_-1`), 254 meters (`u0`), 25.4 decameters (`u0_1`), 2.54 hectometers (`u0_2`), 0.254 kilometers (`u0_3`), 10000000000 microinches (`u207_-6`), and 10000 inches (`u207`) should all convert to each other. The actual number of conversions performed and verified is *n*<sup>2</sup> where *n* is the number of key-value pairs. Conversions from a unit to itself are also included.

The `epsilon` key-value pair states that the maximum allowed difference |*a* − *b*| between the actual result *a* and expected result *b* of a conversion shall be the greater of ( |*a*| + |*b*| ) · *ε* and *ε* (here *ε* = 10<sup>-12</sup>). This is often necessary because floating point has issues (if you know, you know). An epsilon of zero means *a* and *b* must be exactly equal (in the floating point sense, not the real number sense; if you know, you know); an epsilon of 1 means *a* and *b* may be anything as long as they have the same sign. Most test cases use an epsilon of 10<sup>-15</sup> or 10<sup>-12</sup>. Some unlucky test cases may have an epsilon as large as 10<sup>-3</sup>; it is not recommended to have an epsilon larger than this.

### One Half of an Input/Output
Consider this test case for numeral system:

	{
		"name": "one half",
		"z102": "0.1",
		"z104": "0.2",
		"z106": "0.3",
		"z108": "0.4",
		"z110": "0.5",
		"z112": "0.6",
		"z116": "0.8",
		"z120": "0.A",
		"z136": "0.I",
		"z160": "0.U",
		"inputs": {
			"z120": "0.a",
			"z136": "0.i"
		},
		"outputs": {
			"z199": ""
		}
	}

In this test case, the values of `0.a` for `z120` (vigesimal or base 20) and `0.i` for `z136` (sexatrigesimal or base 36) should only be tested as inputs; they should not be tested as outputs because the lowercase letters of the expected output would not match the uppercase letters of the actual output (`0.A` and `0.I` respectively). Similarly, the empty string for `z199` (Roman numerals) should only be tested as an output (given a non-integer, the Roman numeral conversion returns an empty string); it should not be tested as an input because an empty string would result in the actual output of an empty string for every other unit, which will not match any of the expected outputs.
