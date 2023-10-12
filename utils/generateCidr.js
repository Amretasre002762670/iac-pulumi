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
    generateCidr
}





