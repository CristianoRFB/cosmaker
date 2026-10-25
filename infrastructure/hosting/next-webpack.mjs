import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
const require=createRequire(new URL('../../package.json',import.meta.url));
/** Browser Firebase SDK belongs in client components; SSR compilation must not pull its Node gRPC/protobuf implementation. */
export function sparkBuildConfig() {
  if(process.env.COSMAKER_SPARK_BUILD!=='true') return {};
  return {webpack(config,{isServer}) {
    if(isServer) config.resolve.alias['@firebase/firestore$']=resolve(dirname(require.resolve('@firebase/firestore')),'index.esm.js');
    return config;
  }};
}
