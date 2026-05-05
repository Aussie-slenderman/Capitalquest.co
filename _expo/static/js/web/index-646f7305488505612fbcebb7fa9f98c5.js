__d(function(g,r,i,a,m,e,d){Object.defineProperty(e,"__esModule",{value:!0});var n=r(d[0]);Object.keys(n).forEach(function(t){"default"!==t&&"__esModule"!==t&&(t in e&&e[t]===n[t]||Object.defineProperty(e,t,{enumerable:!0,get:function(){return n[t]}}))})},1126,[1127]);
__d(function(g,r,i,a,m,_e,d){Object.defineProperty(_e,"__esModule",{value:!0}),_e.connectFunctionsEmulator=P,_e.getFunctions=
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function(){let n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:(0,e.getApp)(),o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:E;const s=(0,e._getProvider)((0,t.getModularInstance)(n),h).getImmediate({identifier:o}),c=(0,t.getDefaultEmulatorHostnameAndPort)('functions');c&&P(s,...c);return s},_e.httpsCallable=function(e,n,o){return N((0,t.getModularInstance)(e),n,o)},_e.httpsCallableFromURL=function(e,n,o){return v((0,t.getModularInstance)(e),n,o)};var e=r(d[0]),t=r(d[1]),n=r(d[2]);
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const o='type.googleapis.com/google.protobuf.Int64Value',s='type.googleapis.com/google.protobuf.UInt64Value';function c(e,t){const n={};for(const o in e)e.hasOwnProperty(o)&&(n[o]=t(e[o]));return n}function u(e){if(null==e)return null;if(e instanceof Number&&(e=e.valueOf()),'number'==typeof e&&isFinite(e))return e;if(!0===e||!1===e)return e;if('[object String]'===Object.prototype.toString.call(e))return e;if(e instanceof Date)return e.toISOString();if(Array.isArray(e))return e.map(e=>u(e));if('function'==typeof e||'object'==typeof e)return c(e,e=>u(e));throw new Error('Data cannot be encoded in JSON: '+e)}function l(e){if(null==e)return e;if(e['@type'])switch(e['@type']){case o:case s:{const t=Number(e.value);if(isNaN(t))throw new Error('Data cannot be decoded from JSON: '+e);return t}default:throw new Error('Data cannot be decoded from JSON: '+e)}return Array.isArray(e)?e.map(e=>l(e)):'function'==typeof e||'object'==typeof e?c(e,e=>l(e)):e}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const h='functions',p={OK:'ok',CANCELLED:'cancelled',UNKNOWN:'unknown',INVALID_ARGUMENT:'invalid-argument',DEADLINE_EXCEEDED:'deadline-exceeded',NOT_FOUND:'not-found',ALREADY_EXISTS:'already-exists',PERMISSION_DENIED:'permission-denied',UNAUTHENTICATED:'unauthenticated',RESOURCE_EXHAUSTED:'resource-exhausted',FAILED_PRECONDITION:'failed-precondition',ABORTED:'aborted',OUT_OF_RANGE:'out-of-range',UNIMPLEMENTED:'unimplemented',INTERNAL:'internal',UNAVAILABLE:'unavailable',DATA_LOSS:'data-loss'};
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class f extends t.FirebaseError{constructor(e,t,n){super(`${h}/${e}`,t||''),this.details=n}}function k(e){if(e>=200&&e<300)return'ok';switch(e){case 0:case 500:return'internal';case 400:return'invalid-argument';case 401:return'unauthenticated';case 403:return'permission-denied';case 404:return'not-found';case 409:return'aborted';case 429:return'resource-exhausted';case 499:return'cancelled';case 501:return'unimplemented';case 503:return'unavailable';case 504:return'deadline-exceeded'}return'unknown'}function w(e,t){let n,o=k(e),s=o;try{const e=t&&t.error;if(e){const t=e.status;if('string'==typeof t){if(!p[t])return new f('internal','internal');o=p[t],s=t}const c=e.message;'string'==typeof c&&(s=c),n=e.details,void 0!==n&&(n=l(n))}}catch(e){}return'ok'===o?null:new f(o,s,n)}
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class T{constructor(e,t,n){this.auth=null,this.messaging=null,this.appCheck=null,this.auth=e.getImmediate({optional:!0}),this.messaging=t.getImmediate({optional:!0}),this.auth||e.get().then(e=>this.auth=e,()=>{}),this.messaging||t.get().then(e=>this.messaging=e,()=>{}),this.appCheck||n.get().then(e=>this.appCheck=e,()=>{})}async getAuthToken(){if(this.auth)try{const e=await this.auth.getToken();return null==e?void 0:e.accessToken}catch(e){return}}async getMessagingToken(){if(this.messaging&&'Notification'in self&&'granted'===Notification.permission)try{return await this.messaging.getToken()}catch(e){return}}async getAppCheckToken(e){if(this.appCheck){const t=e?await this.appCheck.getLimitedUseToken():await this.appCheck.getToken();return t.error?null:t.token}return null}async getContext(e){return{authToken:await this.getAuthToken(),messagingToken:await this.getMessagingToken(),appCheckToken:await this.getAppCheckToken(e)}}}
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const E='us-central1';function y(e){let t=null;return{promise:new Promise((n,o)=>{t=setTimeout(()=>{o(new f('deadline-exceeded','deadline-exceeded'))},e)}),cancel:()=>{t&&clearTimeout(t)}}}class A{constructor(e,t,n,o){let s=arguments.length>4&&void 0!==arguments[4]?arguments[4]:E,c=arguments.length>5?arguments[5]:void 0;this.app=e,this.fetchImpl=c,this.emulatorOrigin=null,this.contextProvider=new T(t,n,o),this.cancelAllRequests=new Promise(e=>{this.deleteService=()=>Promise.resolve(e())});try{const e=new URL(s);this.customDomain=e.origin+('/'===e.pathname?'':e.pathname),this.region=E}catch(e){this.customDomain=null,this.region=s}}_delete(){return this.deleteService()}_url(e){const t=this.app.options.projectId;if(null!==this.emulatorOrigin){return`${this.emulatorOrigin}/${t}/${this.region}/${e}`}return null!==this.customDomain?`${this.customDomain}/${e}`:`https://${this.region}-${t}.cloudfunctions.net/${e}`}}function I(e,t,n){e.emulatorOrigin=`http://${t}:${n}`}function N(e,t,n){return o=>C(e,t,o,n||{})}function v(e,t,n){return o=>D(e,t,o,n||{})}async function b(e,t,n,o){let s;n['Content-Type']='application/json';try{s=await o(e,{method:'POST',body:JSON.stringify(t),headers:n})}catch(e){return{status:0,json:null}}let c=null;try{c=await s.json()}catch(e){}return{status:s.status,json:c}}function C(e,t,n,o){const s=e._url(t);return D(e,s,n,o)}async function D(e,t,n,o){const s={data:n=u(n)},c={},h=await e.contextProvider.getContext(o.limitedUseAppCheckTokens);h.authToken&&(c.Authorization='Bearer '+h.authToken),h.messagingToken&&(c['Firebase-Instance-ID-Token']=h.messagingToken),null!==h.appCheckToken&&(c['X-Firebase-AppCheck']=h.appCheckToken);const p=y(o.timeout||7e4),k=await Promise.race([b(t,s,c,e.fetchImpl),p.promise,e.cancelAllRequests]);if(p.cancel(),!k)throw new f('cancelled','Firebase Functions instance was deleted.');const T=w(k.status,k.json);if(T)throw T;if(!k.json)throw new f('internal','Response is not valid JSON object.');let E=k.json.data;if(void 0===E&&(E=k.json.result),void 0===E)throw new f('internal','Response is missing data field.');return{data:l(E)}}const O="@firebase/functions",S="0.11.8";function P(e,n,o){I((0,t.getModularInstance)(e),n,o)}var _,U;_=fetch.bind(self),(0,e._registerComponent)(new n.Component(h,(e,t)=>{let{instanceIdentifier:n}=t;const o=e.getProvider('app').getImmediate(),s=e.getProvider("auth-internal"),c=e.getProvider("messaging-internal"),u=e.getProvider("app-check-internal");return new A(o,s,c,u,n,_)},"PUBLIC").setMultipleInstances(!0)),(0,e.registerVersion)(O,S,U),(0,e.registerVersion)(O,S,'esm2017')},1127,[559,561,560]);