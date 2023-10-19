function generateCidrBlocks(baseIp, subnetMask, count) {
    const cidrBlocks = [];
    const ipParts = baseIp.split('.').map(part => parseInt(part, 10));

    for (let i = 0; i < count; i++) {
        // Calculate the subnet start and end addresses
        const subnetStart = i * (256 / count);
        const subnetEnd = (i + 1) * (256 / count) - 1;

        // Ensure that IP parts are integers
        const subnetStartIpParts = ipParts.slice();
        const subnetEndIpParts = ipParts.slice();

        subnetStartIpParts[3] = subnetStart;
        subnetEndIpParts[3] = subnetEnd;

        // Generate the IP addresses for the subnet
        const startIp = subnetStartIpParts.join('.');
        const endIp = subnetEndIpParts.join('.');

        // Create the CIDR block for the subnet
        const cidrBlock = `${startIp}/${subnetMask}`;
        cidrBlocks.push(cidrBlock);
    }

    return cidrBlocks;
}

function generateCidr(baseCidr, count, subnetMask) {
    const base = ipToNumber(baseCidr);
    const subnets = [];

    for (let i = 0; i < count; i++) {
        const subnetStart = base + i * (2 ** (32 - subnetMask));
        const cidr = numberToIp(subnetStart) + '/' + subnetMask;
        subnets.push(cidr);
    }

    return subnets;
}

function ipToNumber(ip) {
    const parts = ip.split('.').map(part => parseInt(part));
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function numberToIp(number) {
    return `${(number >> 24) & 0xFF}.${(number >> 16) & 0xFF}.${(number >> 8) & 0xFF}.${number & 0xFF}`;
}

module.exports = {
    generateCidrBlocks,
    generateCidr
}





