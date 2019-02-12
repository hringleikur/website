const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const klaw = require('klaw')

const CONFIG = "./static/admin/config.yml"
const CONTENT_DIR = "content/cms/";
const CONTENT_SUFFIX = ".yml";

try
{
  var handlers = [];
  yaml.safeLoad(fs.readFileSync(CONFIG, 'utf8'))
    .collections
    .filter(collection=>collection.t_translations)
    .forEach(collection=>{
      if(collection.files)
      {
        collection.files.forEach(file=>file.t_languages ? handlers.push({
          path : file.file,
          languages : file.t_languages,
          fields : file.fields
        }):null)
      }
      else
      {
          handlers.push({
            path : collection.folder,
            languages : collection.t_languages,
            fields: collection.fields
          });
      }
    });
}
catch (e)
{
  console.log(e);
}

function handleFields(handler, content, lang)
{
  var ret = {};

  if(handler.field)
  {
    handler.fields = [handler.field];
  }

  handler.fields.forEach(field=>{
    var value = '';
    var key = '';

    if(field.field || field.fields)
    {
      key = field.name;
      if(content[field.name])
      {
        value = Array.isArray(content[field.name]) ? content[field.name].map(content=>handleFields(field, content, lang)) : handleFields(field, content[field.name], lang);
      }
    }
    else if(field.t_root)
    {
      key = field.t_root;
      if(content[field.t_root + '_' + lang.code])
      {
        value = content[field.t_root + '_' + lang.code];
      }
      else if(lang.langIfEmpty && content[field.t_root + '_' + lang.langIfEmpty])
      {
        value = content[field.t_root + '_' + lang.langIfEmpty];
      }
    }
    else
    {
      key = field.name;
      if(content[field.name])
      {
        value = content[field.name];
      }
    }

    if(value)
    {
      ret[key] = value;
    }

  });
  return ret;
}

klaw(CONTENT_DIR)
  .on('data', item=>item.path.endsWith(CONTENT_SUFFIX) ? handleContentFile(item.path.substr(item.path.indexOf(CONTENT_DIR))) : null);

function handleContentFile(file)
{
  var handler = handlers.find(handler=>file.startsWith(handler.path));
  if(!handler)
  {
    console.log(file);
    return;
  }
  try
  {
    var content = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
    if(!content)
    {
      throw new Error("File empty or not found");
    }
    handler.languages.forEach(lang=>{
      var body = "";
      var frontmatter = handleFields(handler, content, lang, false);
      if(frontmatter.body)
      {
        body = frontmatter.body;
        delete frontmatter.body;
      }

      if(lang.file)
      {
        frontmatter.url = lang.file;
      }
      else if(lang.folder)
      {
        frontmatter.url = lang.folder + "/" + path.basename(file, CONTENT_SUFFIX)
      }

      var outputFile = file
        .replace(CONTENT_DIR, 'content/')
        .replace(CONTENT_SUFFIX, '.' + lang.code + '.md');

      mkdirp.sync(path.dirname(outputFile));

      var stream = fs.createWriteStream(outputFile);
      stream.once('open', function(fd) {
        stream.write("---\n");
        stream.write(yaml.safeDump(frontmatter));
        stream.write("---\n");
        stream.write(body);
        stream.end();
      });
    });
  }
  catch(e)
  {
    console.log("Aborting file: ", e);
  }
}
