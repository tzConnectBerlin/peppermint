import { createRequire } from 'module'
const require = createRequire(import.meta.url);

const CONFIG_PATH = '.'

export default function() {
	let profile = process.env.PEPPERMINT_PROFILE;
	let config_filename = profile ? `config_${profile}.json` : 'config.json';
	console.log(`Reading configuration from ${config_filename}...`);
	return require(`${CONFIG_PATH}/${config_filename}`);
}
