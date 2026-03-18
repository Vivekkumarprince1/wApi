const crypto = require('crypto');
function d(k, r) {
    try {
        const [i, e] = r.split(':');
        let _k = crypto.createHash('sha256').update(String(k)).digest('base64').substring(0, 32); 
        let dec = crypto.createDecipheriv('aes-256-cbc', _k, Buffer.from(i, 'hex'));
        let de = dec.update(Buffer.from(e, 'hex'), 'hex', 'utf8') + dec.final('utf8');
        console.log('decrypted:', de);
    } catch(e){}
}
d('21fa7a5fec48a34ad274c00c12b46661276404edae6fc58f1af6002416d9afd4', '244c7b80a6dffe40bf87f1efbaacfa6d:bd9bfa8efec34af8b4e47087612f009e');
