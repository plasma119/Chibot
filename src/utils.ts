/**
 * shift and return next argument
 */
export function nextArg(args: string[]) {
    const str = args.shift();
    return str ? str.toLowerCase() : '';
}

/**
 * random integer from 0 to i - 1
 */
export function randInt(i: number) {
    return Math.floor(i * Math.random());
}

/**
 * fancy timeout using promise
 */
export function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * formatted date MM/DD/yyyy
 */
export function getFormattedDate(date: Date, seperator = '/') {
    let year = date.getFullYear();
    let month = (1 + date.getMonth()).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    return month + seperator + day + seperator + year;
}
