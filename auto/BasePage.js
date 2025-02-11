import { chromium } from "playwright";

export async function Search(name){
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    const inputName = 'input[id="QueryString"]';
    const buttonSearch = 'Search';

    const searchUrl = 'https://www.appmybizaccount.gov.on.ca/onbis/master/entry.pub?applicationCode=onbis-master&businessService=registerItemSearch'
    await page.goto(searchUrl);

    await page.locator(inputName).fill(name)
    await page.getByText(buttonSearch).click()
    


}

