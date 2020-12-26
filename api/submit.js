const { Octokit } = require("@octokit/rest");
const YAML = require('yaml');
const { v4: uuidv4 } = require('uuid');

let TOKEN = process.env.TOKEN
let REPOSITORY = process.env.REPOSITORY

let [owner, repo] = REPOSITORY.split('/')

const ref = 'heads/master';
const FILE = '100644'; // commit mode
const encoding = 'utf-8';
let settings = { method: "Get" };

let octokit = new Octokit({ auth: TOKEN })

module.exports = async (req, res) => {
  let params = req.body

  console.log(params)

  let data = {
    _id: uuidv4(),
    topic: params['fields[topic]'],
    date: params['fields[date]'],
    title: params['fields[title]'],
    significance: params['fields[significance]'],
    event: params['fields[event]'],
    url: params['fields[url]'],
    type: params['fields[type]'],
    image: params['fields[image]'],
    caption: params['fields[caption]'],
    submitTime: +new Date()
  }

  sanity = true
  musthave = ['topic','date','title','significance','event','url','type']
  musthave.map(item =>{
    if (isEmpty(data['item'])){
      sanity = sanity && false
    }
  })


  let ymlFilename = `${data.date}-entry${data.submitTime}.yml`

  let buffer = Buffer.from(YAML.stringify(data))
  let content = buffer.toString('utf-8')

  let prTitle = `添加新闻事件-${data.topic}-${data.title}`
  let path = `_data/comments/${ymlFilename}`
  let branchName = 'master'

  if(sanity){
    await addFileToGit(path, content, prTitle)
  }
  await new Promise(resolve => setTimeout(resolve, 500))

  res.setHeader('Location', `https://github.com/${REPOSITORY}/tree/${branchName}`)
//   res.setHeader('Location', createdPr.data.html_url)
  res.status(302).send('')
}


async function addFileToGit(path, content, message) {

  // 1. Get the sha of the last commit
  const { data: { object } } = await octokit.git.getRef({repo, owner, ref}); //github.ref(repo, ref).object.sha
  const sha_latest_commit = object.sha; // latest commit

  // 2. Find and store the SHA for the tree object that the heads/master commit points to.
  // sha_base_tree = github.commit(repo, sha_latest_commit).commit.tree.sha
  const { data: { tree }} = await octokit.git.getCommit({repo, owner, commit_sha: sha_latest_commit})
  const sha_base_tree = tree.sha; // root of tree for commit

  // 3. Make some content
  const { data: { sha: blob_sha } } = await octokit.git.createBlob({
    repo, owner, encoding, content,
  });

  // 4. Create a new tree with the content in place
  const { data: new_tree } = await octokit.git.createTree({
    repo, owner,
    base_tree: sha_base_tree, // if we don't set this, all other files will show up as deleted.
    tree: [
      {
        path,
        mode: FILE,
        type: 'blob',
        sha: blob_sha,
      }
    ],
  });

  // 5. Create a new commit with this tree object
  const { data: new_commit } = await octokit.git.createCommit({
    repo, owner,
    message,
    tree: new_tree.sha,
    parents: [
      sha_latest_commit
    ],
  });

  // 6. Move the reference heads/master to point to our new commit object.
  const { data: { object: updated_ref } } = await octokit.git.updateRef({
    repo, owner, ref,
    sha: new_commit.sha, 
  });

  console.log({sha_latest_commit, updated_ref: updated_ref.sha});
}

function isEmpty(str) {
    return (!str || 0 === str.length || !str.trim());
}
