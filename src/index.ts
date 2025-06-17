/**
 * @name match-sorter
 * @license MIT license.
 * @copyright (c) 2099 Kent C. Dodds
 * @author Kent C. Dodds <me@kentcdodds.com> (https://kentcdodds.com)
 */

export type AccessorAttributes = {
	threshold?: Ranking
	maxRanking: Ranking
	minRanking: Ranking
}

export type RankingInfo = MatchRanking & {
	rankedValue: any
	rank: Ranking
	accessorIndex: number
	accessorThreshold: Ranking | undefined
	passed: boolean
}

export interface AccessorOptions<TItem> {
	accessor: AccessorFn<TItem>
	threshold?: Ranking
	maxRanking?: Ranking
	minRanking?: Ranking
}

export type AccessorFn<TItem> = (item: TItem) => string | Array<string>

export type Accessor<TItem> = AccessorFn<TItem> | AccessorOptions<TItem>

export interface RankItemOptions<TItem = unknown> {
	accessors?: ReadonlyArray<Accessor<TItem>>
	threshold?: Ranking
	keepDiacritics?: boolean
}

export const rankings = {
	CASE_SENSITIVE_EQUAL: 7,
	EQUAL: 6,
	STARTS_WITH: 5,
	WORD_STARTS_WITH: 4,
	CONTAINS: 3,
	ACRONYM: 2,
	MATCHES: 1,
	NO_MATCH: 0,
} as const

export type Ranking = (typeof rankings)[keyof typeof rankings]

/**
 * Gets the highest ranking for value for the given item based on its values for the given keys
 * @param {*} item - the item to rank
 * @param {String} value - the value to rank against
 * @param {Object} options - options to control the ranking
 * @return {{rank: Number, accessorIndex: Number, accessorThreshold: Number}} - the highest ranking
 */
export function rankItem<TItem>(
	item: TItem,
	value: string,
	options?: RankItemOptions<TItem>
): RankingInfo {
	options = options || {}

	options.threshold = options.threshold ?? rankings.MATCHES

	if (!options.accessors) {
		// if keys is not specified, then we assume the item given is ready to be matched
		const matchRanking = getMatchRanking(item as unknown as string, value, options)
		return {
			// ends up being duplicate of 'item' in matches but consistent
			rankedValue: item,
			...matchRanking,
			accessorIndex: -1,
			accessorThreshold: options.threshold,
			passed: matchRanking.rank >= options.threshold,
		}
	}

	const valuesToRank = getAllValuesToRank(item, options.accessors)
	let bestMatchRanking: MatchRanking = { rank: rankings.NO_MATCH }
	let passed = false
	let accessorIndex = -1
	let accessorThreshold = options.threshold
	let rankedValue = item

	for (let i = 0; i < valuesToRank.length; i++) {
		const rankValue = valuesToRank[i]!

		let matchRanking = getMatchRanking(rankValue.itemValue, value, options)
		let newRank = matchRanking.rank

		const {
			minRanking,
			maxRanking,
			threshold = options.threshold,
		} = rankValue.attributes

		if (newRank < minRanking && newRank >= rankings.MATCHES) {
			newRank = minRanking
		} else if (newRank > maxRanking) {
			newRank = maxRanking
		}

		newRank = Math.min(newRank, maxRanking) as Ranking

		if (
			newRank >= threshold && (
				newRank > bestMatchRanking.rank || (
					matchRanking.rank == rankings.MATCHES &&
						bestMatchRanking.rank == rankings.MATCHES &&
						matchRanking.closeness > bestMatchRanking.closeness
				)
			)
		) {
			bestMatchRanking = matchRanking
			passed = true
			accessorIndex = i
			accessorThreshold = threshold
			rankedValue = rankValue.itemValue as any
		}
	}

	return {
		rankedValue,
		accessorIndex,
		accessorThreshold,
		passed,
		...bestMatchRanking
	}
}

const similarCharacters = `\
\\s
(?:AE|Æ|Ǽ)
(?:ae|æ|ǽ)
(?:IJ|Ĳ)
(?:ij|ĳ)
(?:OE|Œ)
(?:oe|œ)
(?:TH|Þ)
(?:th|þ)
(?:A|À|Á|Â|Ã|Ä|Å|Ấ|Ắ|Ẳ|Ẵ|Ặ|Ầ|Ằ|Ȃ|Ā|Ă|Ą|Ǎ|Ǻ|A|Ȁ|A)
(?:C|Ç|Ḉ|Ć|Ĉ|Ċ|Č|C|Č)
(?:E|È|É|Ê|Ë|Ế|Ḗ|Ề|Ḕ|Ḝ|Ȇ|Ē|Ĕ|Ė|Ę|Ě|E|Ȅ|Ê|Ȩ|Ɛ)
(?:I|Ì|Í|Î|Ï|Ḯ|Ȋ|Ĩ|Ī|Ĭ|Į|İ|Ǐ|I|Ȉ|I|Ɨ)
(?:D|Ð|Ď|Đ|Ḑ)
(?:N|Ñ|Ń|Ņ|Ň|N|Ǹ)
(?:O|Ò|Ó|Ô|Õ|Ö|Ø|Ố|Ṍ|Ṓ|Ȏ|Ō|Ŏ|Ő|Ơ|Ǒ|Ǿ|Ồ|Ṑ|Ȍ|O)
(?:U|Ù|Ú|Û|Ü|Ũ|Ū|Ŭ|Ů|Ű|Ų|Ȗ|Ư|Ǔ|Ǖ|Ǘ|Ǚ|Ǜ|Ứ|Ṹ|Ừ|Ȕ|U)
(?:Y|Ý|Ŷ|Ÿ|Y|Ỳ|Y)
(?:a|à|á|â|ã|ä|å|ấ|ắ|ẳ|ẵ|ặ|ầ|ằ|ȃ|ā|ă|ą|ǎ|ǻ|a|ȁ|a)
(?:c|ç|ḉ|ć|ĉ|ċ|č|c|č)
(?:e|è|é|ê|ë|ế|ḗ|ề|ḕ|ḝ|ȇ|ē|ĕ|ė|ę|ě|e|ȅ|ê|ȩ|ɛ)
(?:i|ì|í|î|ï|ḯ|ȋ|ĩ|ī|ĭ|į|ı|ǐ|i|ȉ|i|ɨ)
(?:d|ð|ď|đ|ḑ)
(?:n|ñ|ń|ņ|ň|ŉ|n|ǹ)
(?:o|ò|ó|ô|õ|ö|ø|ố|ṍ|ṓ|ȏ|ō|ŏ|ő|ơ|ǒ|ǿ|ồ|ṑ|ȍ|o)
(?:u|ù|ú|û|ü|ũ|ū|ŭ|ů|ű|ų|ȗ|ư|ǔ|ǖ|ǘ|ǚ|ǜ|ứ|ṹ|ừ|ȕ|u)
(?:y|ý|ÿ|ŷ|y|ỳ|y)
(?:G|Ĝ|Ǵ|Ğ|Ġ|Ģ|Ǧ)
(?:g|ĝ|ǵ|ğ|ġ|ģ|ǧ)
(?:H|Ĥ|Ħ|Ḫ|Ȟ|Ḩ)
(?:h|ĥ|ħ|ḫ|ȟ|ḩ)
(?:J|Ĵ|J)
(?:j|ĵ|ǰ)
(?:K|Ķ|Ḱ|K|Ǩ)
(?:k|ķ|ḱ|k|ǩ)
(?:L|Ĺ|Ļ|Ľ|Ŀ)
(?:l|ĺ|ļ|ľ|ŀ|Ł|ł)
(?:M|Ḿ|M|M|M)
(?:m|ḿ|m|m|m)
(?:P|P|Ṕ|P)
(?:p|p|ṕ|p)
(?:R|Ŕ|Ŗ|Ř|R|Ȓ|Ȑ|Ř)
(?:r|ŕ|ŗ|ř|r|ȓ|ȑ|ř)
(?:S|Ś|Ŝ|Ş|Ș|Š|Ṥ|Ṧ)
(?:s|ś|ŝ|ș|ş|š|ſ|ṥ|ṧ)
(?:T|Ţ|Ț|Ť|Ŧ|T)
(?:t|ţ|ț|ť|ŧ|t)
(?:V|V|V)
(?:v|v|v)
(?:W|Ŵ|Ẃ|Ẁ|W)
(?:w|ŵ|ẃ|ẁ|w)
(?:X|X|X|X|X)
(?:x|x|x|x|x)
(?:Z|Ź|Ż|Ž|Z)
(?:z|ź|ż|ž|z)
(?:f|ƒ|f)
(?:Г|Ѓ)
(?:г|ѓ)
(?:К|Ќ)
(?:к|ќ)
(?:B|B|B)
(?:b|b|b)
(?:F|F)
(?:Q|Q|Q)
(?:q|q|q)`.split(`\n`)

function searchRegex(search: string) {
	for (const group of similarCharacters)
		search = search.replace(new RegExp(group, `g`), group)

	return search
}

type MatchRanking =
	{ rank: 0 | 6 | 7 } |
	{ rank: 1, index: number, length: number, closeness: number } |
	{ rank: 2, indexes: number[] } |
	{ rank: 3 | 4, index: number, length: number } |
	{ rank: 5, length: number }

/**
 * Gives a rankings score based on how well the two strings match.
 * @param {String} testString - the string to test against
 * @param {String} stringToRank - the string to rank
 * @param {Object} options - options for the match (like keepDiacritics for comparison)
 * @returns {Number} the ranking for how well stringToRank matches testString
 */
function getMatchRanking<TItem>(
	testString: string,
	stringToRank: string,
	options: RankItemOptions<TItem>
): MatchRanking {
	let searchString = stringToRank

	if (!options.keepDiacritics) {
		searchString = searchRegex(searchString)
	}

	// case sensitive equals
	if (new RegExp(`^${searchString}$`).test(testString)) {
		return { rank: rankings.CASE_SENSITIVE_EQUAL }
	}

	// case insensitive equals
	if (new RegExp(`^${searchString}$`, `i`).test(testString)) {
		return { rank: rankings.EQUAL }
	}

	let match

	// starts with
	if (match = new RegExp(`^${searchString}`, `i`).exec(testString)) {
		return { rank: rankings.STARTS_WITH, length: match[0].length }
	}

	// word starts with
	if (match = new RegExp(`\\s${searchString}`, `i`).exec(testString)) {
		return { rank: rankings.WORD_STARTS_WITH, index: match.index + 1, length: match[0].length - 1 }
	}

	// contains
	if (match = new RegExp(searchString, `i`).exec(testString)) {
		return { rank: rankings.CONTAINS, index: match.index, length: match[0].length }
	}

	// acronym
	if (match = new RegExp(stringToRank.split(``).map(character => `(^|\\s|-)(${searchRegex(character)})(.*)`).join(``)).exec(testString)) {
		const indexes: number[] = []
		let index = match.index

		for (const [ arrayIndex, value ] of match.slice(1).entries()) {
			if (!((arrayIndex + 2) % 3))
				indexes.push(index)

			index += value.length
		}

		return { rank: rankings.ACRONYM, indexes }
	}

	return getClosenessRanking(testString, stringToRank)
}

/**
 * Returns a score based on how spread apart the
 * characters from the stringToRank are within the testString.
 * A number close to rankings.MATCHES represents a loose match. A number close
 * to rankings.MATCHES + 1 represents a tighter match.
 * @param {String} testString - the string to test against
 * @param {String} stringToRank - the string to rank
 * @returns {Number} the number between rankings.MATCHES and
 * rankings.MATCHES + 1 for how well stringToRank matches testString
 */
function getClosenessRanking(
	testString: string,
	stringToRank: string
): MatchRanking {
	let matchingInOrderCharCount = 0
	let charNumber = 0
	function findMatchingCharacter(
		matchChar: undefined | string,
		string: string,
		index: number
	) {
		for (let j = index, J = string.length; j < J; j++) {
			const stringChar = string[j]
			if (stringChar === matchChar) {
				matchingInOrderCharCount += 1
				return j + 1
			}
		}
		return -1
	}
	const firstIndex = findMatchingCharacter(stringToRank[0], testString, 0)
	if (firstIndex < 0) {
		return { rank: rankings.NO_MATCH }
	}
	charNumber = firstIndex
	for (let i = 1, I = stringToRank.length; i < I; i++) {
		const matchChar = stringToRank[i]
		charNumber = findMatchingCharacter(matchChar, testString, charNumber)
		const found = charNumber > -1
		if (!found) {
			return { rank: rankings.NO_MATCH }
		}
	}

	const length = charNumber - firstIndex

	return {
		rank: rankings.MATCHES,
		index: length,
		length: matchingInOrderCharCount,
		closeness: (matchingInOrderCharCount / stringToRank.length) * (1 / length)
	}
}

/**
 * Sorts items that have a rank, index, and accessorIndex
 * @param {Object} a - the first item to sort
 * @param {Object} b - the second item to sort
 * @return {Number} -1 if a should come first, 1 if b should come first, 0 if equal
 */
export function compareItems<TItem>(a: RankingInfo, b: RankingInfo): number {
	return a.rank == rankings.MATCHES && b.rank == rankings.MATCHES ? b.closeness - a.closeness : b.rank - a.rank
}

/**
 * Gets value for key in item at arbitrarily nested keypath
 * @param {Object} item - the item
 * @param {Object|Function} key - the potentially nested keypath or property callback
 * @return {Array} - an array containing the value(s) at the nested keypath
 */
function getItemValues<TItem>(
	item: TItem,
	accessor: Accessor<TItem>
): Array<string> {
	let accessorFn = accessor as AccessorFn<TItem>

	if (typeof accessor === 'object') {
		accessorFn = accessor.accessor
	}

	const value = accessorFn(item)

	// because `value` can also be undefined
	if (value == null) {
		return []
	}

	if (Array.isArray(value)) {
		return value
	}

	return [String(value)]
}

/**
 * Gets all the values for the given keys in the given item and returns an array of those values
 * @param item - the item from which the values will be retrieved
 * @param keys - the keys to use to retrieve the values
 * @return objects with {itemValue, attributes}
 */
function getAllValuesToRank<TItem>(
	item: TItem,
	accessors: ReadonlyArray<Accessor<TItem>>
) {
	const allValues: Array<{
		itemValue: string
		attributes: AccessorAttributes
	}> = []
	for (let j = 0, J = accessors.length; j < J; j++) {
		const accessor = accessors[j]!
		const attributes = getAccessorAttributes(accessor)
		const itemValues = getItemValues(item, accessor)
		for (let i = 0, I = itemValues.length; i < I; i++) {
			allValues.push({
				itemValue: itemValues[i]!,
				attributes,
			})
		}
	}
	return allValues
}

const defaultKeyAttributes = {
	maxRanking: Infinity as Ranking,
	minRanking: -Infinity as Ranking,
}
/**
 * Gets all the attributes for the given accessor
 * @param accessor - the accessor from which the attributes will be retrieved
 * @return object containing the accessor's attributes
 */
function getAccessorAttributes<TItem>(
	accessor: Accessor<TItem>
): AccessorAttributes {
	if (typeof accessor === 'function') {
		return defaultKeyAttributes
	}
	return { ...defaultKeyAttributes, ...accessor }
}
