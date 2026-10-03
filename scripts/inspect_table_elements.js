const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

// Find all buttons, links or inputs inside the table
const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
if (tableMatch) {
  const table = tableMatch[0];
  console.log('Table found, length:', table.length);
  const links = table.match(/<a[\s\S]*?<\/a>/gi) || [];
  console.log('Links in table count:', links.length);
  links.forEach(l => console.log('Link:', l));

  const buttons = table.match(/<button[\s\S]*?<\/button>/gi) || [];
  console.log('Buttons in table count:', buttons.length);
  buttons.forEach(b => console.log('Button:', b));

  const inputs = table.match(/<input[\s\S]*?>/gi) || [];
  console.log('Inputs in table count:', inputs.length);
  inputs.forEach(inp => console.log('Input:', inp));
} else {
  console.log('No table found');
}
