const {
  BaseKonnector,
  log,
  requestFactory,
  saveFiles,
  errors
} = require('cozy-konnector-libs')
const request = requestFactory({
  //cheerio: true
  debug: false,
  json: true,
  jar: true
})
const moment = require('moment')

const baseStartUrl = 'https://www.lucca.fr'
let baseWorkspaceUrl
let userId

module.exports = new BaseKonnector(start)
// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
async function start(fields) {
  await logIn(fields)
  const payslips = await getPayslips()
  await saveFiles(payslips, fields)
  // .then(convertPayrollsToCozy)
  // .then(documents => saveFiles(documents, fields));
}

async function logIn(fields) {
  log('info', 'First log in to get user company details...')
  try {
    const details = await request({
      uri: baseStartUrl + '/login/ws-auth-service/wsauth.service.php',
      method: 'POST',
      form: {
        mail: fields.login,
        password: fields.password,
        request: 'emailpass'
      }
    })
    baseWorkspaceUrl = details.data.user.instance.href
    userId = details.data.user.login

    // const uri =
    //   "https://auth.payfit.com/updateCurrentCompany?application=hr-apps/user&companyId=";

    // return request({
    //   uri: `${uri}${companyId}&customApp=false&employeeId=${employeeId}&holdingId&idToken=${idToken}&origin=https://app.payfit.com`
    // });
  } catch (err) {
    if (
      err.statusCode === 404 &&
      err.error.Message &&
      err.error.Message.includes('Wrong password')
    ) {
      throw new Error(errors.LOGIN_FAILED)
    } else {
      throw new Error(errors.VENDOR_DOWN)
    }
  }

  log('info', 'Log in with company URL')
  try {
    await request({
      uri: baseWorkspaceUrl + '/login',
      method: 'POST',
      form: {
        login: userId,
        Password: fields.password,
        PersistentCookie: true
      }
    })
    // const uri =
    //   "https://auth.payfit.com/updateCurrentCompany?application=hr-apps/user&companyId=";

    // return request({
    //   uri: `${uri}${companyId}&customApp=false&employeeId=${employeeId}&holdingId&idToken=${idToken}&origin=https://app.payfit.com`
    // });
  } catch (err) {
    if (
      err.statusCode === 400 &&
      err.error &&
      err.error.includes('Vos identifiants sont erron&#233;s')
    ) {
      throw new Error(errors.LOGIN_FAILED)
    }
  }
}

async function getPayslips() {
  log('info', 'Get Pagga userId')
  const userDetails = await request({
    uri: baseWorkspaceUrl + '/api/v3/users/me?fields=id',
    method: 'GET'
  })
  const paggaUserId = userDetails.data.id

  log('info', 'Get Payslips')
  const payslipsInfos = await request({
    uri:
      baseWorkspaceUrl +
      '/api/v3/payslips?fields=id,import[endDate]&orderby=import.endDate,desc,import.startDate,desc,import.creationDate,desc&ownerID=' +
      paggaUserId,
    method: 'GET'
  })

  return payslipsInfos.data.items.map(function(payslip) {
    const url = baseWorkspaceUrl + '/pagga/download/' + payslip.id
    const date = moment(payslip.import.endDate, moment.ISO_8601)
    const filename = date.format('YYYY_MM') + '.pdf'

    return {
      fileurl: url,
      filename
    }
  })
}
