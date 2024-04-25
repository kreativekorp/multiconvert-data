# MultiConvert Data
This repository contains source data for the MultiConvert app.

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
	},

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
	},

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
	},

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
	},

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
	},

This is read as "to convert from `u900`, degrees Fahrenheit, to kelvin (the base unit for temperature), subtract 32, multiply by 5, divide by 9, and add 273.15." (To convert in the other direction, the instructions must of course be performed in reverse.)

The following instructions are allowed in the `instructions` field:

| instruction | operation      | formula                      |
| ----------- | -------------- | ---------------------------- |
| `A`*a*      | add            | *x'* = *x* + *a*             |
| `S`*a*      | subtract       | *x'* = *x* − *a*             |
| `Z`*a*      | subtract from  | *x'* = *a* − *x*             |
| `M`*a*      | multiply       | *x'* = *x* × *a*             |
| `D`*a*      | divide         | *x'* = *x* ÷ *a*             |
| `G`*a*      | divide into    | *x'* = *a* ÷ *x*             |
| `P`*a*      | power          | *x'* = *x*<sup>*a*</sup>     |
| `R`*a*      | root           | *x'* = *x*<sup>1÷*a*</sup>   |
| `X`*a*      | exponential    | *x'* = *a*<sup>*x*</sup>     |
| `L`*a*      | logarithm      | *x'* = log<sub>*a*</sub> *x* |
| `E`*a*      | natural exp    | *x'* = e<sup>*x*</sup> − *a* |
| `N`*a*      | natural log    | *x'* = ln (*x* + *a*)        |
| `C`*a*      | circumference  | *x'* = *x* × π ÷ *a*         |
| `Q`*a*      | diameter       | *x'* = *x* × *a* ÷ π         |
| `R2`        | `sqrt`         | *x'* = √*x*                  |
| `R3`        | `cbrt`         | *x'* = ∛*x*                  |
| `L2`        | `log2`         | *x'* = log<sub>2</sub> *x*   |
| `L10`       | `log10`        | *x'* = log<sub>10</sub> *x*  |
| `E0`        | `exp`          | *x'* = e<sup>*x*</sup>       |
| `E1`        | `expm1`        | *x'* = e<sup>*x*</sup> − 1   |
| `N0`        | `log`          | *x'* = ln *x*                |
| `N1`        | `log1p`        | *x'* = ln (*x* + 1)          |
| `C180`      | `toRadians`    | *x'* = *x* × π ÷ 180         |
| `Q180`      | `toDegrees`    | *x'* = *x* × 180 ÷ π         |
| `F1`        | `sin`          | *x'* = sin *x*               |
| `F2`        | `cos`          | *x'* = cos *x*               |
| `F3`        | `tan`          | *x'* = tan *x*               |
| `F4`        | `cot`          | *x'* = cot *x*               |
| `F5`        | `sec`          | *x'* = sec *x*               |
| `F6`        | `csc`          | *x'* = csc *x*               |
| `F7`        | `sinh`         | *x'* = sinh *x*              |
| `F8`        | `cosh`         | *x'* = cosh *x*              |
| `F9`        | `tanh`         | *x'* = tanh *x*              |
| `F10`       | `coth`         | *x'* = coth *x*              |
| `F11`       | `sech`         | *x'* = sech *x*              |
| `F12`       | `csch`         | *x'* = csch *x*              |
| `V1`        | `asin`         | *x'* = sin<sup>−1</sup> *x*  |
| `V2`        | `acos`         | *x'* = cos<sup>−1</sup> *x*  |
| `V3`        | `atan`         | *x'* = tan<sup>−1</sup> *x*  |
| `V4`        | `acot`         | *x'* = cot<sup>−1</sup> *x*  |
| `V5`        | `asec`         | *x'* = sec<sup>−1</sup> *x*  |
| `V6`        | `acsc`         | *x'* = csc<sup>−1</sup> *x*  |
| `V7`        | `asinh`        | *x'* = sinh<sup>−1</sup> *x* |
| `V8`        | `acosh`        | *x'* = cosh<sup>−1</sup> *x* |
| `V9`        | `atanh`        | *x'* = tanh<sup>−1</sup> *x* |
| `V10`       | `acoth`        | *x'* = coth<sup>−1</sup> *x* |
| `V11`       | `asech`        | *x'* = sech<sup>−1</sup> *x* |
| `V12`       | `acsch`        | *x'* = csch<sup>−1</sup> *x* |

Instructions such as integer divide, modulus, comparisons, gamma function, etc. are not available because they cannot be performed in reverse.

Scientific notation is not supported in the `instructions` field. An instruction such as `M2E3` will be interpreted as *x'* = e<sup>2*x*</sup>−3, not *x'* = 2000*x*.
