import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sparkBuildConfig} from '../../hosting/next-webpack.mjs';
test('Legacy Next configuration stays unchanged unless Spark build is explicitly selected',()=>{
  const old=process.env.COSMAKER_SPARK_BUILD;
  try {
    delete process.env.COSMAKER_SPARK_BUILD;assert.deepEqual(sparkBuildConfig(),{});
    process.env.COSMAKER_SPARK_BUILD='true';const config=sparkBuildConfig();assert.equal(typeof config.webpack,'function');
    const browser={resolve:{alias:{}}};assert.equal(config.webpack(browser,{isServer:false}),browser);assert.deepEqual(browser.resolve.alias,{});
  } finally {if(old===undefined)delete process.env.COSMAKER_SPARK_BUILD;else process.env.COSMAKER_SPARK_BUILD=old;}
});
