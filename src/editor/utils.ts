export async function dynamicImport(file: string) {
    return (await import(`../language-definition/${file}`)).default;
}
    